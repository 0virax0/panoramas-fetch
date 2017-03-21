var server = require('./static_server.js')   //start node server
const {app, BrowserWindow} = require('electron')
let win

function createWindow(){
  win = new BrowserWindow({width: 800, height: 600})
  win.loadURL('file://'+__dirname+'/public/index.html')
  win.webContents.openDevTools()
  win.on('closed', () => win=null)
}
app.on('ready', createWindow)
app.on('window-all-closed', () => {
  app.close
  server.quit()
})
