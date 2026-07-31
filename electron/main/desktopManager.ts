import { BrowserWindow, dialog, ipcMain } from 'electron'
import fs from 'fs/promises'
import { exec } from 'child_process'

class DesktopManager {
  private static instance: DesktopManager | null = null

  constructor() {
    if (DesktopManager.instance) {
      return DesktopManager.instance
    }
    DesktopManager.instance = this
    this.registerIpcHandlers()
  }

  static getInstance(): DesktopManager {
    if (!DesktopManager.instance) {
      DesktopManager.instance = new DesktopManager()
    }
    return DesktopManager.instance
  }

  private registerIpcHandlers() {
    // Remove existing handlers if they exist
    if (ipcMain.listenerCount('desktop:listDirectory') > 0) {
      ipcMain.removeAllListeners('desktop:listDirectory')
    }
    if (ipcMain.listenerCount('desktop:executeCommand') > 0) {
      ipcMain.removeAllListeners('desktop:executeCommand')
    }
    ipcMain.handle('desktop:listDirectory', async (event, dirPath) => {
      try {
        const files = await fs.readdir(dirPath)
        return { success: true, files }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle(
      'desktop:executeCommand',
      async (event, command: unknown) => {
        if (typeof command !== 'string' || command.trim().length === 0) {
          return { success: false, error: 'A command is required.' }
        }

        if (command.length > 16_000) {
          return { success: false, error: 'Command is too long.' }
        }

        const owner = BrowserWindow.fromWebContents(event.sender)
        const confirmation = owner
          ? await dialog.showMessageBox(owner, {
              type: 'warning',
              buttons: ['Cancel', 'Run once'],
              defaultId: 0,
              cancelId: 0,
              noLink: true,
              title: 'Allow command execution?',
              message: 'Alice wants to execute a command on this computer.',
              detail: command,
            })
          : await dialog.showMessageBox({
              type: 'warning',
              buttons: ['Cancel', 'Run once'],
              defaultId: 0,
              cancelId: 0,
              noLink: true,
              title: 'Allow command execution?',
              message: 'Alice wants to execute a command on this computer.',
              detail: command,
            })

        if (confirmation.response !== 1) {
          return { success: false, error: 'Command execution denied by user.' }
        }

        return new Promise(resolve => {
          exec(command, (error, stdout, stderr) => {
            if (error) {
              resolve({ success: false, error: error.message })
              return
            }
            if (stderr) {
              resolve({ success: false, error: stderr })
              return
            }
            resolve({ success: true, output: stdout })
          })
        })
      }
    )
  }
}

export default DesktopManager
