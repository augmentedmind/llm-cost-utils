#!/usr/bin/env node

/**
 * This script downloads the latest model prices and context window information
 * from the litellm GitHub repository and saves it to a local file.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const MODEL_PRICES_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
const OUTPUT_DIR = path.join(__dirname, '../src/data')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'model-prices.json')

// Ensure the output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

console.log(`Downloading model prices from ${MODEL_PRICES_URL}...`)

// Download the file
https
  .get(MODEL_PRICES_URL, (response) => {
    if (response.statusCode !== 200) {
      console.error(`Failed to download file: ${response.statusCode} ${response.statusMessage}`)
      process.exit(1)
    }

    let data = ''
    response.on('data', (chunk) => {
      data += chunk
    })

    response.on('end', () => {
      try {
        // Parse the JSON to validate it
        const modelPrices = JSON.parse(data)

        // Pretty print the JSON with 2 spaces indentation
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(modelPrices, null, 2))

        console.log(`Model prices saved to ${OUTPUT_FILE}`)

        // Print a sample of the data
        console.log('\nSample of model prices:')
        const models = Object.keys(modelPrices)
        const sampleModels = models.slice(0, 5) // Show first 5 models

        sampleModels.forEach((model) => {
          console.log(
            `- ${model}: Input $${modelPrices[model].input_cost_per_token * 1000000}/M tokens, Output $${modelPrices[model].output_cost_per_token * 1000000}/M tokens`,
          )
        })

        console.log(`\n...and ${models.length - 5} more models`)
      } catch (error) {
        console.error('Error processing the downloaded file:', error)
        process.exit(1)
      }
    })
  })
  .on('error', (error) => {
    console.error('Error downloading the file:', error)
    process.exit(1)
  })
