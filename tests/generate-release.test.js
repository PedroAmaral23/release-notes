
const { test } = require("node:test")
const assert = require("node:assert/strict")

const {
  classify,
  cleanText,
  getWorkItemIds
} = require("../scripts/generate-release.js")

// 🔹 Classificação dos commits

test("Deve classificar uma funcionalidade", () => {
  assert.equal(
    classify("feature/1234/nova-funcionalidade AB#1234"),
    "feature"
  )
})

test("Deve classificar uma correção", () => {
  assert.equal(
    classify("bugfix/1234/corrigir-erro AB#1234"),
    "bugfix"
  )
})

test("Deve classificar um débito técnico", () => {
  assert.equal(
    classify("dt/1234/refatoracao AB#1234"),
    "tech"
  )
})

test("Deve classificar um commit desconhecido como other", () => {
  assert.equal(classify("Atualizar README"), "other")
})

test("Deve lidar com um commit vazio", () => {
  assert.equal(classify(""), "other")
})

test("Deve lidar com um commit nulo", () => {
  assert.equal(classify(null), "other")
})

// 🔹 Limpeza de texto

test("Deve remover tags HTML", () => {
  assert.equal(
    cleanText("<p>Nova <strong>funcionalidade</strong></p>"),
    "Nova funcionalidade"
  )
})

test("Deve remover espaços desnecessários", () => {
  assert.equal(
    cleanText("  Nova    funcionalidade  "),
    "Nova funcionalidade"
  )
})

test("Deve converter entidades HTML", () => {
  assert.equal(
    cleanText("Nova&nbsp;funcionalidade"),
    "Nova funcionalidade"
  )
})

test("Deve preservar frases completas", () => {
  assert.equal(
    cleanText("Versão 2.0. Corrigido erro de login."),
    "Versão 2.0. Corrigido erro de login."
  )
})

test("Deve ignorar URLs de links HTML", () => {
  assert.equal(
    cleanText('<a href="https://example.com">Documentação</a>'),
    "Documentação"
  )
})

test("Deve ignorar imagens HTML", () => {
  assert.equal(
    cleanText('<img src="image.png" alt="Imagem">'),
    ""
  )
})

test("Deve lidar com texto nulo", () => {
  assert.equal(cleanText(null), "")
})

test("Deve lidar com texto vazio", () => {
  assert.equal(cleanText(""), "")
})

// 🔹 Extração de IDs

test("Deve extrair os IDs das tarefas", () => {
  const commits = [
    { workItemId: "1234" },
    { workItemId: "5678" }
  ]

  assert.deepEqual(
    getWorkItemIds(commits),
    ["1234", "5678"]
  )
})

test("Deve remover IDs duplicados", () => {
  const commits = [
    { workItemId: "1234" },
    { workItemId: "1234" },
    { workItemId: "5678" }
  ]

  assert.deepEqual(
    getWorkItemIds(commits),
    ["1234", "5678"]
  )
})

test("Deve ignorar commits sem ID", () => {
  const commits = [
    { workItemId: null },
    { workItemId: "1234" },
    { workItemId: undefined }
  ]

  assert.deepEqual(
    getWorkItemIds(commits),
    ["1234"]
  )
})

test("Deve lidar com uma lista vazia de commits", () => {
  assert.deepEqual(getWorkItemIds([]), [])
})
