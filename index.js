var path = require('path'),
    fs = require('fs'),
    app = require('electron').app,
    ipc = require('electron').ipcMain,
    session = require('electron').session,
    BrowserWindow = require('electron').BrowserWindow,
    request = require('request'),
    mkdirp = require('mkdirp'),
    async = require('async'),
    debug = require('debug')('doc88-download'),
    program = require('commander'),
    doc88util = require('./doc88util');

function myParseInt(string, defaultValue) {
    var int = parseInt(string, 10);
    return typeof int === 'number' ? int : defaultValue;
}

program
    .version(require('./package.json').version)
    .usage('[options] <url>')
    .option('-o, --out-dir <dir>', 'output directory, default "./output"', 'output')
    .option('-f, --plugin-flash-path <path>', 'flash Player plugin path')
    .option('-d, --force-download', 'force download if PNG already exists')
    .option('-w, --wait <ms>', 'milliseconds to wait before capture, default 1000', myParseInt, 1000)
    .option('-c, --concurrent-worker <max>', 'max concurrent worker for capture, default 1', myParseInt, 1)
    .option('-t, --scale-up-factor <t>', 'scale up factor, default 4', myParseInt, 4)
    .parse(process.argv);
if (!program.args || program.args.length == 0) program.help();
debug('args: out-dir: %s', program.outDir);
debug('args: plugin-flash-path: %s', program.pluginFlashPath);
debug('args: force-download: %s', program.forceDownload ? true : false);
debug('args: wait: %s', program.wait);
debug('args: concurrent-worker: %s', program.concurrentWorker);
debug('args: scale-up-factor: %s', program.scaleUpFactor);
debug('args: url: %s', program.args);

var ppapiFlashPath;
if (program.pluginFlashPath) {
    ppapiFlashPath = program.pluginFlashPath;
} else if (process.platform == 'win32') {
    ppapiFlashPath = path.join(__dirname, 'plugins', 'pepflashplayer.dll');
} else if (process.platform == 'linux') {
    ppapiFlashPath = path.join(__dirname, 'plugins', 'libpepflashplayer.so');
} else if (process.platform == 'darwin') {
    ppapiFlashPath = path.join(__dirname, 'plugins', 'PepperFlashPlayer.plugin');
}
app.commandLine.appendSwitch('ppapi-flash-path', ppapiFlashPath);
debug('append switch ppapi-flash-path="%s"', ppapiFlashPath);

var mainWin;

app.on('ready', main);
app.on('window-all-closed', function () { /* do nothing */ });
mkdirp(program.outDir);

function main() {
    debug('evt: ready');
    session.defaultSession.webRequest.onBeforeSendHeaders(function (details, callback) {
        var cancel = details.resourceType != 'mainFrame';
        // only allow critical script
        if (details.resourceType == 'script' && [
            '/jquery',
            '/view-mini.js'
        ].map(function (value, index) {
            return details.url.indexOf(value) != -1;
        }).indexOf(true) != -1) {
            cancel = false;
        }
        if (!cancel) debug('req: ' + details.method + ' - ' + details.url + ' [' + details.resourceType + `]`);
        callback({
            cancel: cancel
        });
    });

    mainWin = new BrowserWindow({
        show: false
    });
    console.log('Fetching ' + program.args[0]);
    mainWin.loadURL(program.args[0]);
    mainWin.webContents.once('did-finish-load', function () {
        debug('evt: did-finish-load');
        mainWin.webContents.executeJavaScript(`
            require('electron').ipcRenderer.sendSync('document:retrieved', {
                'html': document.documentElement.innerHTML,
                'mpib': window.mpib,
                'mtp': window.mtp,
                'mhost': window.mhost,
                'mhi': window.mhi,
                'mpebt': window.mpebt,
                'madif': window.madif,
                'p_s': window.p_s,
                'product_code': window.product_code
            });
        `);
    });
}

ipc.on('document:retrieved', function (evt, props) {
    debug('evt: document:retrieved')
    console.log('Page loaded')
    if (!props.mpib) {
        console.log('Unable to get page context, please check network connection and URL');
        return app.exit(1);
    }
    var pageContext = doc88util.decodePageContext(props.mpib).split(',');
    var docDir = path.resolve(path.join(program.outDir, props.product_code));
    var htmlDir = path.join(docDir, 'html');
    var pngDir = path.join(docDir, 'png');
    mkdirp(docDir);
    mkdirp(htmlDir);
    mkdirp(pngDir);

    if (props && props.product_code && props.html) {
        var fullHtmlFile = path.join(docDir, 'raw.html');
        fs.writeFileSync(fullHtmlFile, props.html);
        console.log(`Wrote raw html file '${fullHtmlFile}'`);
    }

    var totalPageStrLength = String(props.mtp).length;
    console.log('Total pages: ' + props.mtp);
    var pageDimension = [];
    var htmlFiles = [];
    for (var i = 0; i < props.mtp; i++) {
        var flashVars = doc88util.constructFlashParams(i + 1, pageContext, props.mtp, props.mhost, props.mhi, props.mpebt, props.madif, props.p_s);
        var pageContextCodes = pageContext[i].split('-');
        var width = parseInt(pageContextCodes[1]) * program.scaleUpFactor;
        var height = parseInt(pageContextCodes[2]) * program.scaleUpFactor;
        var html =
            `<!DOCTYPE html>\n<html><body style="width:${width}px;height:${height}px;overflow:hidden;margin:0">` +
            '<object type="application/x-shockwave-flash" data="http://assets.doc88.com/assets/swf/pv.swf?v=1.7" width="100%" height="100%" style="visibility: visible;">' +
            '<param name="hasPriority" value="true"><param name="wmode" value="transparent"><param name="swliveconnect" value="true">' +
            '<param name="FlashVars" value="' + flashVars + '">' +
            '<param name="allowScriptAccess" value="always"></object></body></html>';
        var htmlFile = path.join(htmlDir, `${padLeft(i + 1, totalPageStrLength)}.html`);
        fs.writeFileSync(htmlFile, html);
        htmlFiles.push(htmlFile);
        pageDimension[i] = {
            width: width,
            height: height
        };
    }
    console.log(`Wrote page html to directory '${htmlDir}'`);
    session.defaultSession.webRequest.onBeforeSendHeaders(null);
    async.eachOfLimit(htmlFiles, program.concurrentWorker, function (item, key, callback) {
        var file = htmlFiles[key];
        var pngFile = path.join(pngDir, `${padLeft(key + 1, totalPageStrLength)}.png`);
        if (!program.forceDownload && fs.existsSync(pngFile)) {
            console.log(`Image for page ${key + 1} already exists, skip processing '${file}'`)
            return callback();
        }
        var win = new BrowserWindow({
            useContentSize: true,
            frame: false,
            show: false,
            autoHideMenuBar: true,
            enableLargerThanScreen: true,
            backgroundColor: '#FF0000',
            webPreferences: {
                plugins: true
            }
        });
        win.webContents.once('did-finish-load', function () {
            debug('evt: did-finish-load: `%s`', file);
            win.setSize(pageDimension[key].width, pageDimension[key].height);
            setTimeout(function () {
                debug('capturing image of `%s`', file);
                win.capturePage(function (img) {
                    fs.writeFile(pngFile, img.toPNG(), function (err) {
                        if (err) return console.err(err);
                        console.log(`Processed '${file}', image saved at '${pngFile}'`);
                    });
                    win.destroy();
                    callback();
                });
            }, program.wait);
        });
        debug('load ' + file);
        win.loadURL('file://' + file);
    }, function (err) {
        if (err) console.err(err);
        console.log('Processed all pages');
        app.exit(0);
    });
    evt.returnValue = true;
    mainWin.destroy();

    function padLeft(nr, n, str) {
        return Array(n - String(nr).length + 1).join(str || '0') + nr;
    }
});