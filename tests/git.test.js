
const { test } = require("node:test")
const assert = require("node:assert/strict")
const { execFileSync } = require("node:child_process")
const { mkdtempSync, rmSync } = require("node:fs")
const { tmpdir } = require("node:os")
const { join } = require("node:path")

const scriptPath = require.resolve("../scripts/generate-release.js")

// 🔹 Executa uma função do script em um processo isolado
function runFunction(functionName, env = {}, cwd = process.cwd()) {
    const code = `
        const functions = require(${JSON.stringify(scriptPath)})
        const result = functions[${JSON.stringify(functionName)}]()
        console.log(JSON.stringify(result))
    `

    const output = execFileSync(
        process.execPath,
        ["-e", code],
        {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: {
            ...process.env,
            GIT_BEFORE: "",
            GIT_AFTER: "",
            DRY_RUN: "false",
            ...env
        }
        }
    )

    return JSON.parse(output)
}

// 🔹 Testes de intervalo de commits

test("Deve montar um intervalo válido de commits", () => {
  const before = "a".repeat(40)
  const after = "b".repeat(40)

  const result = runFunction("getCommitRange", {
    GIT_BEFORE: before,
    GIT_AFTER: after
  })

  assert.equal(result, `${before}..${after}`)
})

test("Deve utilizar HEAD quando GIT_AFTER não for definido", () => {
  const before = "a".repeat(40)

  const result = runFunction("getCommitRange", {
    GIT_BEFORE: before
  })

  assert.equal(result, `${before}..HEAD`)
})

test("Deve utilizar o último commit no Dry Run local", () => {
  const result = runFunction("getCommitRange", {
    DRY_RUN: "true"
  })

  assert.equal(result, "HEAD~1..HEAD")
})

test("Deve rejeitar execução normal sem GIT_BEFORE", () => {
  assert.throws(
    () => runFunction("getCommitRange"),
    /GIT_BEFORE não foi definido/
  )
})

test("Deve rejeitar SHA anterior inválido", () => {
  assert.throws(
    () => runFunction("getCommitRange", {
      GIT_BEFORE: "invalid"
    }),
    /GIT_BEFORE inválido/
  )
})

test("Deve rejeitar SHA posterior inválido", () => {
  assert.throws(
    () => runFunction("getCommitRange", {
      GIT_BEFORE: "a".repeat(40),
      GIT_AFTER: "invalid"
    }),
    /GIT_AFTER inválido/
  )
})

test("Deve rejeitar SHA anterior composto por zeros", () => {
  assert.throws(
    () => runFunction("getCommitRange", {
      GIT_BEFORE: "0".repeat(40)
    }),
    /Não existe um commit anterior/
  )
})

// 🔹 Teste de leitura real dos commits

test("Deve ler commits corretamente em um repositório Git", () => {
  const directory = mkdtempSync(
    join(tmpdir(), "release-notes-test-")
  )

  function git(...args) {
    return execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8"
    }).trim()
  }

  try {
    git("init")
    git("config", "user.name", "Release Notes Test")
    git("config", "user.email", "test@example.com")
    git("config", "commit.gpgsign", "false")

    // Commit inicial, fora do intervalo da publicação
    git("commit", "--allow-empty", "-m",
      "Commit inicial"
    )

    const before = git("rev-parse", "HEAD")

    // Funcionalidade com descrição de múltiplas linhas
    git("commit", "--allow-empty", "-m",
      "feature/1234/login AB#1234",
      "-m",
      "Primeira linha\nSegunda linha | Versão 2.0."
    )

    // Correção sem descrição
    git("commit", "--allow-empty", "-m",
      "bugfix/5678/corrigir-login AB#5678"
    )

    // Commit sem tarefa associada
    git("commit", "--allow-empty", "-m",
      "Atualizar README"
    )

    const after = git("rev-parse", "HEAD")

    const commits = runFunction("getCommits", {
      GIT_BEFORE: before,
      GIT_AFTER: after
    }, directory)

    // Deve retornar apenas os três commits do intervalo
    assert.equal(commits.length, 3)

    const feature = commits.find(
      commit => commit.workItemId === "1234"
    )

    const bugfix = commits.find(
      commit => commit.workItemId === "5678"
    )

    const other = commits.find(
      commit => commit.workItemId === null
    )

    assert.ok(feature)
    assert.ok(bugfix)
    assert.ok(other)

    // Valida a descrição com múltiplas linhas
    assert.equal(
      feature.body.trim().replace(/\r\n/g, "\n"),
      "Primeira linha\nSegunda linha | Versão 2.0."
    )

    // Valida commit sem descrição
    assert.equal(bugfix.body.trim(), "")

    // Valida commit sem tarefa
    assert.equal(other.subject, "Atualizar README")

    // Valida os hashes
    commits.forEach(commit => {
      assert.match(commit.hash, /^[a-f0-9]{40}$/)
    })

    // Garante que o commit inicial não foi incluído
    assert.ok(
      !commits.some(commit => commit.hash === before)
    )
  } finally {
    rmSync(directory, {
      recursive: true,
      force: true
    })
  }
})
