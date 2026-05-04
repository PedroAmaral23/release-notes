const { execSync } = require("child_process")
const axios = require("axios")

const AZURE_TOKEN = process.env.AZURE_TOKEN
const ORG = "pedrohta007"
const PROJECT = "test-release"

// 🔹 1. Pega commits
const commitsRaw = execSync('git log -10 --pretty=format:"%s"').toString()

// 🔹 2. Extrai IDs AB#1234
const ids = [...new Set(
  (commitsRaw.match(/AB#(\d+)/g) || [])
    .map(x => x.replace("AB#", ""))
)]

// 🔹 3. Função pra buscar no Azure
async function getWorkItem(id) {
  const url = `https://dev.azure.com/${ORG}/${PROJECT}/_apis/wit/workitems/${id}?api-version=7.0`

  const res = await axios.get(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`:${AZURE_TOKEN}`).toString("base64")}`
    }
  })

  return {
    id,
    title: res.data.fields["System.Title"],
    description: res.data.fields["System.Description"] || ""
  }
}

// 🔹 4. Classificar pelo commit
function classify(commit) {
  if (commit.includes("feature/")) return "feature"
  if (commit.includes("bugfix/")) return "bugfix"
  if (commit.includes("dt/")) return "tech"
  return "other"
}

// 🔹 5. Montar release
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
    })
    output += "\n"
  }

  if (grouped.bugfix.length) {
    output += "🐛 Correções\n"
    grouped.bugfix.forEach(i => {
      output += `- #${i.id} - ${i.title}\n`
    })
    output += "\n"
  }

  if (grouped.tech.length) {
    output += "🔧 Débito Técnico\n"
    grouped.tech.forEach(i => {
      output += `- #${i.id} - ${i.title}\n`
    })
    output += "\n"
  }

  console.log(output)
}

main()