// @ts-check

const http = require("http");
const request = require("request");
const escapeHtml = require("escape-html");
const {
    JSDOM
} = require("jsdom");

const CONFIG = {
    PORT: process.env.PORT || 3000
};

function serverInitializer() {
    const server = http.createServer((req, res) => {
        const urlInfo = getNichanUrlInfo(req.url);
        if (urlInfo === null) {
            responseError(res, "URLが不正 例: http://xxx/${ドメイン}.5ch.net/test/read.cgi/${板名}/${スレID}/${レス番号}");
            return;
        }
        const threadUrl = `http://${urlInfo.subDomainName}.5ch.net/test/read.cgi/${urlInfo.boardName}/${urlInfo.threadId}`;
        const commentUrl = `${threadUrl}/${urlInfo.commentId || "1"}`;
        request.get(commentUrl, {
            encoding: null
        }, (error, nichanRes, /** @type {NodeBuffer} */ body) => {
            if (error) {
                responseError(res, `接続エラー URL: ${commentUrl}`);
                return;
            }
            try {
                const dom = new JSDOM(body);
                const title = dom.window.document.title;
                const textElement = dom.window.document.querySelector("div.message > span.escaped");
                res.writeHead(200, {
                    "Content-Type": "text/html"
                });
                res.write(createHtml(create2chTwitterCard({
                        threadTitle: title,
                        resBody: textElement.textContent.substring(0, 200)
                    }),
                    "2chツイッター表示くん 0秒後に2chにリダイレクト",
                    urlInfo.commentId ? commentUrl : threadUrl
                ));
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

function getNichanUrlInfo(/** @type {string} */ url) {
    const result = url.match(/\/(.+?)\.5ch\.net\/test\/read\.cgi\/(.+?)\/([0-9]{10})(\/([0-9]{1,4})\/?)?/);
    if (result === null) {
        return null;
    }
    return {
        subDomainName: result[1],
        boardName: result[2],
        threadId: result[3],
        commentId: result[5]
    };
}

function responseError( /** @type {http.ServerResponse} */ res, /** @type {string} */ message) {
    res.writeHead(200, {
        "Content-Type": "text/html"
    });
    res.write(createHtml(null, `error: ${message}`));
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

function createHtml( /** @type {string} */ head, /** @type {string} */ body, /** @type {string} */ redirectUrl) {
    return `
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8">
            ${head ? head : ""}
        </head>
            <body>
            ${escapeHtml(body)}
            ${redirectUrl ? `
            <script>
                location.href = "${escapeHtml(redirectUrl)}";
            </script>
            ` : ""}
            </body>
    </html>
    `;
}

serverInitializer();