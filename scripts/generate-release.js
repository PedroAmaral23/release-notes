const { execSync } = require("child_process")
const axios = require("axios")
const { google } = require("googleapis")

const AZURE_TOKEN = process.env.AZURE_TOKEN
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS

const ORG = "pedrohta007"
const PROJECT = "test-release"
const DOC_ID = "1KolGW4llvF5Cy43hISJfTkQzFJ2yIRj7tzdXB-wnWlI"

// 🔹 1. Pega commits da main
const commitsRaw = execSync('git log -10 --pretty=format:"%s"').toString()

// 🔹 2. Extrai IDs AB#12345
const ids = [...new Set(
  (commitsRaw.match(/AB#(\d+)/g) || [])
    .map(x => x.replace("AB#", ""))
)]

// 🔹 3. Limpeza de texto t
function cleanText(text) {
  return text
    .replace(/<[^>]+>/g, "")        // remove HTML tags
    .replace(/&nbsp;/g, " ")        // remove espaço HTML
    .replace(/&amp;/g, "&")         // (extra - bom já tratar)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function simplify(text) {
  return cleanText(text).split(".")[0]
}

// 🔹 4. Buscar Work Item no Azure
async function getWorkItem(id) {
  try {
    const url = `https://dev.azure.com/${ORG}/${PROJECT}/_apis/wit/workitems/${id}?api-version=7.0`

    const res = await axios.get(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`:${AZURE_TOKEN}`).toString("base64")}`
      }
    })

    return {
      id,
      title: res.data.fields["System.Title"],
      description: cleanText(res.data.fields["System.Description"] || "")
    }
  } catch (err) {
    console.log(`Erro ao buscar task ${id}`)
    return {
      id,
      title: "Erro ao buscar título",
      description: ""
    }
  }
}

// 🔹 5. Classificação
function classify(commit) {
  if (commit.includes("feature/")) return "feature"
  if (commit.includes("bugfix/")) return "bugfix"
  if (commit.includes("dt/")) return "tech"
  return "other"
}

// 🔹 6. Escrever no Google Docs
async function writeToGoogleDocs(text) {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(GOOGLE_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/documents"]
  })

  const docs = google.docs({ version: "v1", auth })

  await docs.documents.batchUpdate({
    documentId: DOC_ID,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: text + "\n\n----------------------\n\n"
          }
        }
      ]
    }
  })
}

// 🔹 7. Montar release
async function main() {
  const items = await Promise.all(ids.map(getWorkItem))

  const grouped = {
    feature: [],
    bugfix: [],
    tech: []
  }

  items.forEach(item => {
    const commit = commitsRaw.split("\n").find(c => c.includes(`AB#${item.id}`))
    const type = classify(commit || "")

    if (grouped[type]) {
      grouped[type].push(item)
    }
  })

  const now = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })

  let output = `🚀 Publicação em: ${now}\n\n`

  if (grouped.feature.length) {
    output += "✨ Funcionalidades\n"
    grouped.feature.forEach(i => {
      output += `- #${i.id} - ${i.title}\n`
      if (i.description) {
        output += `  → ${simplify(i.description)}\n`
      }
    })
    output += "\n"
  }

  if (grouped.bugfix.length) {
    output += "🐛 Correções\n"
    grouped.bugfix.forEach(i => {
      output += `- #${i.id} - ${i.title}\n`
      if (i.description) {
        output += `  → ${simplify(i.description)}\n`
      }
    })
    output += "\n"
  }

  if (grouped.tech.length) {
    output += "🔧 Débito Técnico\n"
    grouped.tech.forEach(i => {
      output += `- #${i.id} - ${i.title}\n`
      if (i.description) {
        output += `  → ${simplify(i.description)}\n`
      }
    })
    output += "\n"
  }

  if (!grouped.feature.length && !grouped.bugfix.length && !grouped.tech.length) {
    output += "Nenhuma alteração relevante encontrada.\n"
  }

  console.log(output)

  // 🔥 escreve no Google Docs
  try {
    await writeToGoogleDocs(output)
    console.log("✅ Google Docs atualizado")
    } catch (err) {
    console.log("❌ Erro Google Docs:", err.message)
    }
}

main()