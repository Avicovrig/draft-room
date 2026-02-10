#!/usr/bin/env node
import { readFileSync } from 'fs'
import { join } from 'path'

function main() {
  try {
    const input = readFileSync(0, 'utf-8')
    if (!input.trim()) process.exit(0)

    let prompt = ''
    try {
      const data = JSON.parse(input)
      // UserPromptSubmit provides the user's prompt in the input
      prompt = (data.prompt || data.message || '').toLowerCase()
    } catch {
      // If stdin isn't valid JSON, treat the raw input as the prompt
      prompt = input.toLowerCase()
    }

    if (!prompt) process.exit(0)

    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()
    const rulesPath = join(projectDir, '.claude', 'skills', 'skill-rules.json')

    let rules
    try {
      rules = JSON.parse(readFileSync(rulesPath, 'utf-8'))
    } catch {
      // skill-rules.json not found, skip silently
      process.exit(0)
    }

    const matchedSkills = []

    for (const [skillName, config] of Object.entries(rules.skills)) {
      const triggers = config.promptTriggers
      if (!triggers) continue

      let matched = false

      // Keyword matching
      if (triggers.keywords) {
        matched = triggers.keywords.some(kw => prompt.includes(kw.toLowerCase()))
      }

      // Intent pattern matching (only if keyword didn't match)
      if (!matched && triggers.intentPatterns) {
        matched = triggers.intentPatterns.some(pattern => {
          try {
            return new RegExp(pattern, 'i').test(prompt)
          } catch {
            return false
          }
        })
      }

      if (matched) {
        matchedSkills.push({ name: skillName, config })
      }
    }

    if (matchedSkills.length > 0) {
      const lines = [
        '',
        '--- SKILL ACTIVATION ---',
        'Relevant skills detected for this prompt:',
        ''
      ]

      for (const skill of matchedSkills) {
        const isGuardrail = skill.config.type === 'guardrail'
        const prefix = isGuardrail ? 'GUARDRAIL' : 'RECOMMENDED'
        lines.push(`  [${prefix}] ${skill.name}`)
        if (skill.config.description) {
          lines.push(`    ${skill.config.description}`)
        }
      }

      lines.push('')
      lines.push('ACTION: Read the relevant SKILL.md file(s) before making changes.')
      lines.push('--- END SKILL ACTIVATION ---')
      lines.push('')

      process.stdout.write(lines.join('\n'))
    }

    process.exit(0)
  } catch {
    // Fail silently — hooks should never block the user
    process.exit(0)
  }
}

main()
