const { execSync } = require("child_process")
const axios = require("axios")
const { google } = require("googleapis")

const AZURE_TOKEN = process.env.AZURE_TOKEN
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS

const ORG = "pedrohta007"
const PROJECT = "test-release"
const DOC_ID = "1KolGW4llvF5Cy43hISJfTkQzFJ2yIRj7tzdXB-wnWlI"

// 🔹 1. Pega commits COMPLETOS (AGORA COM BODY)
const commitsRaw = execSync('git log -10 --pretty=format:"%H|%s|%b"').toString()

// 🔹 2. Transforma commits em objeto estruturado
const commits = commitsRaw.split("\n").map(line => {
  const [hash, subject, body] = line.split("|")

  const match = subject.match(/AB#(\d+)/)

  return {
    hash,
    subject,
    body,
    workItemId: match ? match[1] : null
  }
})

// 🔹 3. Extrai IDs únicos
const ids = [...new Set(
  commits
    .filter(c => c.workItemId)
    .map(c => c.workItemId)
)]

// 🔹 4. Limpeza de texto
function cleanText(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function simplify(text) {
  return cleanText(text).split(".")[0]
}

// 🔹 5. Buscar Work Item no Azure (AGORA SEM DESCRIPTION)
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
      title: res.data.fields["System.Title"]
    }
  } catch (err) {
    console.log(`Erro ao buscar task ${id}`)
    return {
      id,
      title: "Erro ao buscar título"
    }
  }
}

// 🔹 6. Classificação
function classify(commit) {
  if (!commit) return "other"
  if (commit.includes("feature/")) return "feature"
  if (commit.includes("bugfix/")) return "bugfix"
  if (commit.includes("dt/")) return "tech"
  return "other"
}

// 🔹 7. Google Docs
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

// 🔹 8. Montar release
async function main() {
  const items = await Promise.all(ids.map(getWorkItem))

  const grouped = {
    feature: [],
    bugfix: [],
    tech: []
  }

  items.forEach(item => {
    const relatedCommits = commits.filter(c => c.workItemId == item.id)

    if (!relatedCommits.length) return

    const type = classify(relatedCommits[0].subject)

    const descriptions = relatedCommits.map(c =>
      cleanText(c.body || c.subject)
    )

    if (grouped[type]) {
      grouped[type].push({
        id: item.id,
        title: item.title,
        descriptions
      })
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

  function appendSection(title, list) {
    if (!list.length) return

    output += `${title}\n`

    list.forEach(i => {
      output += `- #${i.id} - ${i.title}\n`

      i.descriptions.forEach(desc => {
        if (desc) {
          output += `  → ${simplify(desc)}\n`
        }
      })
    })

    output += "\n"
  }

  appendSection("✨ Funcionalidades", grouped.feature)
  appendSection("🐛 Correções", grouped.bugfix)
  appendSection("🔧 Débito Técnico", grouped.tech)

  if (!grouped.feature.length && !grouped.bugfix.length && !grouped.tech.length) {
    output += "Nenhuma alteração relevante encontrada.\n"
  }

  console.log(output)

  try {
    await writeToGoogleDocs(output)
  } catch (err) {
    console.log("Erro Google Docs:", err.message)
  }
}

main()