var path = require('path'),
    fs = require('fs'),
    app = require('electron').app,
    ipc = require('electron').ipcMain,
    BrowserWindow = require('electron').BrowserWindow,
    request = require('request'),
    mkdirp = require('mkdirp'),
    async = require('async'),
    debug = require('debug')('doc88-download'),
    program = require('commander'),
    doc88util = require('./doc88util');

program
    .usage('[options] <url>')
    .option('-o, --out-dir <dir>', 'Output directory, default "./output"', 'output')
    .option('-f, --plugin-flash-path <path>', 'Flash Player plugin path')
    .option('-d, --force-download', 'Force download if PNG already exists')
    .option('-w, --wait <ms>', 'Milliseconds to wait before capture, default 1500', 1500)
    .option('-c, --concurrent-worker <max>', 'Max concurrent worker for capture, default 1', 1)
    .parse(process.argv);
if (!program.args || program.args.length == 0) program.help();
debug('args: out-dir: %s', program.outDir);
debug('args: plugin-flash-path: %s', program.pluginFlashPath);
debug('args: force-download: %s', program.forceDownload ? true : false);
debug('args: wait: %s', program.wait);
debug('args: concurrent-worker: %s', program.concurrentWorker);
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
    mainWin = new BrowserWindow({
        show: false
    });
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
        debug('wrote raw.html to path "%s"', fullHtmlFile);
    }

    var htmlFiles = [];
    for (var i = 0; i < props.mtp; i++) {
        var flashVars = doc88util.constructFlashParams(i + 1, pageContext, props.mtp, props.mhost, props.mhi, props.mpebt, props.madif, props.p_s);
        var html =
            '<!DOCTYPE html>\n<html><body style="width:3840px;height:5428px;overflow:hidden;margin:0">' +
            '<object type="application/x-shockwave-flash" data="http://assets.doc88.com/assets/swf/pv.swf?v=1.7" width="100%" height="100%" style="visibility: visible;">' +
            '<param name="hasPriority" value="true"><param name="wmode" value="transparent"><param name="swliveconnect" value="true">' +
            '<param name="FlashVars" value="' + flashVars + '">' +
            '<param name="allowScriptAccess" value="always"></object></body></html>';
        var htmlFile = path.join(htmlDir, 'page' + (i + 1) + '.html');
        fs.writeFileSync(htmlFile, html);
        htmlFiles.push(htmlFile);
    }
    async.eachOfLimit(htmlFiles, program.concurrentWorker, function (item, key, callback) {
        var file = htmlFiles[key];
        var pngFile = path.join(pngDir, `page${key + 1}.png`);
        if (!program.forceDownload && fs.existsSync(pngFile)) {
            debug('png file exists, skip processing `%s`', file);
            return callback();
        }
        debug('processing `%s`', file);
        var win = new BrowserWindow({
            useContentSize: true,
            frame: true,
            show: false,
            autoHideMenuBar: true,
            enableLargerThanScreen: true,
            backgroundColor: '#FF0000',
            webPreferences: {
                plugins: true
            }
        });
        win.on('ready-to-show', function () {
            debug('ready to show `%s`', file);
            win.setSize(3840 + 16, 5428 + 39);;
            setTimeout(function () {
                debug('capturing image of `%s`', file);
                win.capturePage(function (img) {
                    fs.writeFile(pngFile, img.toPNG());
                    win.destroy();
                    callback();
                });
            }, program.wait);
        })
        debug('load ' + file);
        win.loadURL('file://' + file);
    }, function (err) {
        if (err) console.err(err);
        debug('exit');
        app.exit(0);
    });
    evt.returnValue = true;
    mainWin.destroy();
});
