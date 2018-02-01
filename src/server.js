// @ts-check

const http = require("http");
const request = require("request");
const escapeHtml = require("escape-html");
const iconv = require("iconv-lite");
const {
    JSDOM
} = require("jsdom");

const CONFIG = {
    PORT: process.env.PORT || 30154
};

function serverInitializer() {
    const server = http.createServer((req, res) => {
        const url = req.url;
        if (url === undefined) {
            responseError(res, "URLが不正");
            return;
        }
        const splitedUrl = url.split("/");
        if (!(splitedUrl.length >= 6 &&
                splitedUrl[1] === "5ch" &&
                splitedUrl[2] &&
                splitedUrl[3] &&
                /[0-9]{10}/.test(splitedUrl[4]) &&
                (!splitedUrl[5] || /[0-9]{1,4}/.test(splitedUrl[5])))) {
            responseError(res, "URLが不正 例: http://xxx/5ch/serverName/bordName/threadId/commentId");
            return;
        }
        const targetUrl = `http://${splitedUrl[2]}.${splitedUrl[1]}.net/test/read.cgi/${splitedUrl[3]}/${splitedUrl[4]}/${splitedUrl[5] || "1"}`;
        request.get(targetUrl, {
            encoding: null
        }, (error, nichanRes, /** @type {NodeBuffer} */ body) => {
            if (error) {
                responseError(res, `接続エラー URL: ${targetUrl}`);
                return;
            }
            try {
                const decodedBody = iconv.decode(body, "shift_jis");
                const dom = new JSDOM(body);
                const title = dom.window.document.title;
                const textElement = dom.window.document.querySelector("div.message > span.escaped");
                res.writeHead(200, {
                    "Content-Type": "text/html"
                });
                res.write(createHtml(create2chTwitterCard({
                    threadTitle: title,
                    resBody: textElement.textContent.substring(0, 200)
                }), "2chツイッター表示くん"));
                res.end();
            } catch (error) {
                // tslint:disable-next-line
                console.error(error);
                responseError(res, "パースエラー");
            }
        });
    });

    server.listen(CONFIG.PORT, () => {
        // tslint:disable-next-line
        console.log(`Server running port: ${CONFIG.PORT}`);
    });
}

function responseError( /** @type {http.ServerResponse} */ res, /** @type {string} */ message) {
    res.writeHead(200, {
        "Content-Type": "text/html"
    });
    res.write(createHtml(null, `error: ${escapeHtml(message)}`));
    res.end();
}

/**
 * @typedef CardInfo
 * @type {Object}
 * @property {string} threadTitle
 * @property {string} resBody
 */
function create2chTwitterCard( /** @type {CardInfo} */ cardInfo) {
    return `
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(cardInfo.threadTitle)} 5ちゃんねる" />
    <meta name="twitter:description" content="${escapeHtml(cardInfo.resBody)}" />
    <meta name="twitter:image" content="https://i.imgur.com/i1sq3No.jpg" />
    `;
}

function createHtml( /** @type {string} */ head, /** @type {string} */ body) {
    return `
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8">
            ${head ? head : ""}
        </head>
            <body>${body}</body>
    </html>
    `;
}

serverInitializer();