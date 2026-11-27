
const { test } = require("node:test")
const assert = require("node:assert/strict")

const {
  groupWorkItems,
  formatRelease
} = require("../scripts/generate-release.js")

// 🔹 Dados simulados do Azure DevOps

const items = [
  {
    id: "1234",
    title: "Implementar tela de login"
  },
  {
    id: "5678",
    title: "Corrigir erro de autenticação"
  },
  {
    id: "9012",
    title: "Refatorar serviço de usuários"
  }
]

// 🔹 Commits simulados

const commits = [
  {
    workItemId: "1234",
    subject: "feature/1234/login AB#1234",
    body: "Implementada a tela de login."
  },
  {
    workItemId: "5678",
    subject: "bugfix/5678/auth AB#5678",
    body: "Corrigido erro de autenticação."
  },
  {
    workItemId: "9012",
    subject: "dt/9012/refatoracao AB#9012",
    body: "Melhorada a organização do serviço."
  }
]

// 🔹 Testes de agrupamento

test("Deve agrupar tarefas nas categorias corretas", () => {
  const grouped = groupWorkItems(items, commits)

  assert.equal(grouped.feature.length, 1)
  assert.equal(grouped.bugfix.length, 1)
  assert.equal(grouped.tech.length, 1)

  assert.equal(grouped.feature[0].id, "1234")
  assert.equal(grouped.bugfix[0].id, "5678")
  assert.equal(grouped.tech[0].id, "9012")
})

test("Deve preservar o título retornado pelo Azure", () => {
  const grouped = groupWorkItems(items, commits)

  assert.equal(
    grouped.feature[0].title,
    "Implementar tela de login"
  )
})

test("Deve utilizar a descrição do commit", () => {
  const grouped = groupWorkItems(items, commits)

  assert.deepEqual(
    grouped.feature[0].descriptions,
    ["Implementada a tela de login."]
  )
})

test("Deve agrupar múltiplos commits da mesma tarefa", () => {
  const additionalCommits = [
    ...commits,
    {
      workItemId: "1234",
      subject: "feature/1234/validacao AB#1234",
      body: "Adicionada validação dos campos."
    }
  ]

  const grouped = groupWorkItems(items, additionalCommits)

  assert.equal(grouped.feature.length, 1)

  assert.deepEqual(
    grouped.feature[0].descriptions,
    [
      "Implementada a tela de login.",
      "Adicionada validação dos campos."
    ]
  )
})

test("Deve remover descrições duplicadas", () => {
  const duplicatedCommits = [
    ...commits,
    { ...commits[0] }
  ]

  const grouped = groupWorkItems(items, duplicatedCommits)

  assert.equal(grouped.feature[0].descriptions.length, 1)
})

test("Deve utilizar o assunto quando a descrição estiver vazia", () => {
  const emptyBodyCommits = [
    {
      ...commits[0],
      body: ""
    }
  ]

  const grouped = groupWorkItems(items, emptyBodyCommits)

  assert.deepEqual(
    grouped.feature[0].descriptions,
    ["feature/1234/login AB#1234"]
  )
})

test("Deve limpar HTML das descrições", () => {
  const htmlCommits = [
    {
      ...commits[0],
      body: "<p>Implementada&nbsp;a tela de login.</p>"
    }
  ]

  const grouped = groupWorkItems(items, htmlCommits)

  assert.deepEqual(
    grouped.feature[0].descriptions,
    ["Implementada a tela de login."]
  )
})

test("Deve ignorar tarefas sem commits relacionados", () => {
  const grouped = groupWorkItems(items, [commits[0]])

  assert.equal(grouped.feature.length, 1)
  assert.equal(grouped.bugfix.length, 0)
  assert.equal(grouped.tech.length, 0)
})

test("Deve lidar com listas vazias", () => {
  assert.deepEqual(
    groupWorkItems([], []),
    {
      feature: [],
      bugfix: [],
      tech: []
    }
  )
})

// 🔹 Testes de formatação

test("Deve gerar todas as seções da release", () => {
  const grouped = groupWorkItems(items, commits)
  const output = formatRelease(grouped)

  assert.ok(output.includes("✨ Funcionalidades"))
  assert.ok(output.includes("🐛 Correções"))
  assert.ok(output.includes("🔧 Débito Técnico"))
})

test("Deve formatar corretamente os IDs e títulos", () => {
  const grouped = groupWorkItems(items, commits)
  const output = formatRelease(grouped)

  assert.ok(
    output.includes("- #1234 - Implementar tela de login")
  )

  assert.ok(
    output.includes("- #5678 - Corrigir erro de autenticação")
  )

  assert.ok(
    output.includes("- #9012 - Refatorar serviço de usuários")
  )
})

test("Deve incluir as descrições na release", () => {
  const grouped = groupWorkItems(items, commits)
  const output = formatRelease(grouped)

  assert.ok(
    output.includes("→ Implementada a tela de login.")
  )
})

test("Deve formatar a data no horário de São Paulo", () => {
  const grouped = groupWorkItems(items, commits)

  const date = new Date("2026-11-27T17:30:00Z")

  const output = formatRelease(grouped, date)

  assert.match(
    output,
    /🚀 Publicação em: 27\/11\/2026,? 14:30/
  )
})

test("Deve omitir categorias vazias", () => {
  const grouped = groupWorkItems(items, [commits[0]])
  const output = formatRelease(grouped)

  assert.ok(output.includes("✨ Funcionalidades"))
  assert.ok(!output.includes("🐛 Correções"))
  assert.ok(!output.includes("🔧 Débito Técnico"))
})

test("Deve retornar texto vazio quando não houver tarefas", () => {
  const grouped = {
    feature: [],
    bugfix: [],
    tech: []
  }

  assert.equal(formatRelease(grouped), "")
})

test("Deve gerar uma release completa corretamente", () => {
  const grouped = groupWorkItems(items, commits)
  const date = new Date("2026-11-27T17:30:00Z")

  const output = formatRelease(grouped, date)

  const expected = [
    "🚀 Publicação em: 27/11/2026, 14:30",
    "",
    "✨ Funcionalidades",
    "- #1234 - Implementar tela de login",
    "  → Implementada a tela de login.",
    "",
    "🐛 Correções",
    "- #5678 - Corrigir erro de autenticação",
    "  → Corrigido erro de autenticação.",
    "",
    "🔧 Débito Técnico",
    "- #9012 - Refatorar serviço de usuários",
    "  → Melhorada a organização do serviço.",
    "",
    ""
  ].join("\n")

  assert.equal(
    output.replace("27/11/2026 14:30", "27/11/2026, 14:30"),
    expected
  )
})


test("Deve incluir commits sem prefixo associados à mesma tarefa", () => {
    const relatedCommits = [
      commits[0],
      {
        workItemId: "1234",
        subject: "Adicionada validação AB#1234",
        body: "Adicionada validação dos campos."
      }
    ]

    const grouped = groupWorkItems(items, relatedCommits)

    assert.deepEqual(
      grouped.feature[0].descriptions,
      [
        "Implementada a tela de login.",
        "Adicionada validação dos campos."
      ]
    )
  })

  test("Deve classificar a tarefa mesmo quando o primeiro commit não possui prefixo", () => {
    const relatedCommits = [
      {
        workItemId: "1234",
        subject: "Melhorado layout AB#1234",
        body: "Melhorado o layout."
      },
      commits[0]
    ]

    const grouped = groupWorkItems(items, relatedCommits)

    assert.equal(grouped.feature.length, 1)

    assert.deepEqual(
      grouped.feature[0].descriptions,
      [
        "Melhorado o layout.",
        "Implementada a tela de login."
      ]
    )
  })

  test("Deve ignorar tarefas sem nenhum commit classificável", () => {
    const unclassifiedCommits = [
      {
        workItemId: "1234",
        subject: "Atualizar documentação AB#1234",
        body: "Documentação atualizada."
      }
    ]

    const grouped = groupWorkItems(items, unclassifiedCommits)

    assert.deepEqual(grouped, {
      feature: [],
      bugfix: [],
      tech: []
    })
  })
