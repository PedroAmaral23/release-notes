
const { convert } = require("html-to-text")
const { execFileSync } = require("child_process")
const axios = require("axios")
const { google } = require("googleapis")

const AZURE_TOKEN = process.env.AZURE_TOKEN
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS

const ORG = process.env.AZURE_ORG
const PROJECT = process.env.AZURE_PROJECT
const DOC_ID = process.env.GOOGLE_DOC_ID
const DRY_RUN = process.env.DRY_RUN === "true"

// 🔹 1. Identifica o intervalo de commits
function getCommitRange() {
  const before = process.env.GIT_BEFORE
  const after = process.env.GIT_AFTER || "HEAD"

  if (!before) {
    if (DRY_RUN) {
      return "HEAD~1..HEAD"
    }

    throw new Error("GIT_BEFORE não foi definido.")
  }

  if (/^0+$/.test(before)) {
    throw new Error("Não existe um commit anterior para definir o intervalo.")
  }

  if (!/^[a-f0-9]{40}$/i.test(before)) {
    throw new Error("GIT_BEFORE inválido.")
  }

  if (after !== "HEAD" && !/^[a-f0-9]{40}$/i.test(after)) {
    throw new Error("GIT_AFTER inválido.")
  }

  return `${before}..${after}`
}

// 🔹 2. Busca e estrutura os commits
function getCommits() {
  const range = getCommitRange()

  const commitsRaw = execFileSync(
    "git",
    [
      "log",
      "-z",
      "--format=%H%x00%s%x00%b",
      range,
      "--"
    ],
    { encoding: "utf8" }
  )

  const fields = commitsRaw.split("\0")
  const commits = []

  for (let i = 0; i + 2 < fields.length; i += 3) {
    const [hash, subject, body] = fields.slice(i, i + 3)

    if (!hash || !subject) continue

    const match = subject.match(/AB#(\d+)/)

    commits.push({
      hash,
      subject,
      body,
      workItemId: match ? match[1] : null
    })
  }

  return commits
}

// 🔹 3. Extrai IDs únicos
function getWorkItemIds(commits) {
  return [...new Set(
    commits
      .filter(c => c.workItemId)
      .map(c => c.workItemId)
  )]
}

// 🔹 4. Limpeza de texto
function cleanText(text) {
  return convert(text ?? "", {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" }
    ]
  })
    .replace(/\s+/g, " ")
    .trim()
}

// 🔹 5. Buscar Work Item no Azure
async function getWorkItem(id) {
  try {
    const url = `https://dev.azure.com/${ORG}/${PROJECT}/_apis/wit/workitems/${id}?api-version=7.0`

    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        Authorization: `Basic ${Buffer.from(`:${AZURE_TOKEN}`).toString("base64")}`
      }
    })

    return {
      id,
      title: res.data.fields["System.Title"]
    }
  } catch (err) {
    throw new Error(
      `Erro ao buscar task ${id} no Azure DevOps: ${err.message}`
    )
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

function groupWorkItems(items, relevantCommits) {
  const grouped = {
    feature: [],
    bugfix: [],
    tech: []
  }

  items.forEach(item => {
    const relatedCommits = relevantCommits.filter(
      c => c.workItemId === item.id
    )

    if (!relatedCommits.length) return

    const classifiedCommit = relatedCommits.find(
      c => classify(c.subject) !== "other"
    )

    if (!classifiedCommit) return

    const type = classify(classifiedCommit.subject)

    const descriptions = [...new Set(
      relatedCommits
        .map(c => cleanText(c.body.trim() || c.subject))
        .filter(Boolean)
    )]

    grouped[type].push({
      id: item.id,
      title: item.title,
      descriptions
    })
  })

  return grouped
}

function formatRelease(grouped, date = new Date()) {
  if (
    !grouped.feature.length &&
    !grouped.bugfix.length &&
    !grouped.tech.length
  ) {
    return ""
  }

  const now = date.toLocaleString("pt-BR", {
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
        output += `  → ${desc}\n`
      })
    })

    output += "\n"
  }

  appendSection("✨ Funcionalidades", grouped.feature)
  appendSection("🐛 Correções", grouped.bugfix)
  appendSection("🔧 Débito Técnico", grouped.tech)

  return output
}

// 🔹 8. Montar release
async function main() {
  const commits = getCommits()

  const relevantCommits = commits.filter(c => c.workItemId)

  const classifiedCommits = relevantCommits.filter(
    c => classify(c.subject) !== "other"
  )

  const ids = getWorkItemIds(classifiedCommits)

  if (!ids.length) {
    console.error("Nenhuma alteração relevante encontrada.")
    return
  }

  const items = await Promise.all(ids.map(getWorkItem))

  const grouped = groupWorkItems(items, relevantCommits)

  const output = formatRelease(grouped)

  if (!output) {
    console.error("Nenhuma alteração relevante encontrada.")
    return
  }

  if (DRY_RUN) {
    console.error("[DRY RUN] Publicação no Google Docs ignorada.")
  } else {
    await writeToGoogleDocs(output)
  }

  console.log(output)
}

if (require.main === module) {
  main().catch(err => {
    console.error("Erro ao gerar release notes:", err.message)
    process.exitCode = 1
  })
}

module.exports = {
  getCommitRange,
  getCommits,
  getWorkItemIds,
  cleanText,
  classify,
  groupWorkItems,
  formatRelease
}
