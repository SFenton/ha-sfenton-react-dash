import { access, constants } from 'node:fs/promises'
import { join } from 'node:path'
import chalk from 'chalk'
import * as dotenv from 'dotenv'
import { Client } from 'node-scp'
import prompts from 'prompts'

dotenv.config()

const HA_URL = process.env.VITE_HA_URL
const HA_TOKEN = process.env.VITE_HA_TOKEN
const USERNAME = process.env.VITE_SSH_USERNAME
const PASSWORD = process.env.VITE_SSH_PASSWORD
const HOST_OR_IP_ADDRESS = process.env.VITE_SSH_HOSTNAME
const PORT = 22
const REMOTE_FOLDER_NAME = process.env.VITE_FOLDER_NAME
const LOCAL_DIRECTORY = './dist'
const REMOTE_PATH = `/www/${REMOTE_FOLDER_NAME}`

async function confirmDeploymentWithHaToken() {
  if (!HA_TOKEN) {
    return
  }

  const response = (await prompts({
    type: 'confirm',
    name: 'value',
    message: chalk.yellow(
      'WARN: You are about to deploy to Home Assistant with VITE_HA_TOKEN set in .env. Continue?',
    ),
    initial: true,
  })) as { value: boolean }

  if (response.value !== true) {
    process.exit()
  }
}

async function checkDirectoryExists() {
  try {
    await access(LOCAL_DIRECTORY, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function deploy() {
  try {
    if (!HA_URL) throw new Error('Missing VITE_HA_URL in .env file')
    if (!REMOTE_FOLDER_NAME) throw new Error('Missing VITE_FOLDER_NAME in .env file')
    if (!USERNAME) throw new Error('Missing VITE_SSH_USERNAME in .env file')
    if (!PASSWORD) throw new Error('Missing VITE_SSH_PASSWORD in .env file')
    if (!HOST_OR_IP_ADDRESS) throw new Error('Missing VITE_SSH_HOSTNAME in .env file')

    const exists = await checkDirectoryExists()
    if (!exists) {
      throw new Error('Missing ./dist directory, have you run `npm run build`?')
    }

    const client = await Client({
      host: HOST_OR_IP_ADDRESS,
      port: PORT,
      username: USERNAME,
      password: PASSWORD,
    })

    const directories = ['config', 'homeassistant']
    let matched = false

    for (const dir of directories) {
      const remote = `/${dir}${REMOTE_PATH}`
      const rootExists = await client.exists(`/${dir}`)

      if (rootExists) {
        matched = true
        try {
          await client.rmdir(remote)
        } catch {
          // The remote dashboard directory may not exist yet.
        }

        console.info(chalk.blue('Uploading', `"${LOCAL_DIRECTORY}"`, 'to', `"${remote}"`))
        await client.uploadDir(LOCAL_DIRECTORY, remote)
        client.close()
        console.info(chalk.green('\nSuccessfully deployed!'))
        console.info(chalk.blue(join(HA_URL, '/local', REMOTE_FOLDER_NAME, '/index.html')))
        break
      }
    }

    if (!matched) {
      throw new Error('Could not find a config/homeassistant directory in the Home Assistant installation root.')
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(chalk.red('Error:', error.message))
    }
  }
}

await confirmDeploymentWithHaToken()
await deploy()