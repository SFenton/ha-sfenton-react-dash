import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'

dotenv.config()

const VITE_FOLDER_NAME = process.env.VITE_FOLDER_NAME

// https://vite.dev/config/
export default defineConfig({
  base: VITE_FOLDER_NAME ? `/local/${VITE_FOLDER_NAME}/` : '/',
  plugins: [react()],
})
