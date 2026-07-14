import { describe, it, expect, beforeEach } from 'vitest'
import { t, setLanguage, getLanguage, getAvailableLanguages } from './i18n.js'

describe('i18n', () => {
  beforeEach(() => {
    setLanguage('en')
  })

  describe('t()', () => {
    it('returns the translation string for an existing key', () => {
      const result = t('app.title')
      expect(result).toBe('dev-dashboard')
    })

    it('returns the key as fallback when key does not exist', () => {
      const result = t('nonexistent.key.here')
      expect(result).toBe('nonexistent.key.here')
    })

    it('returns the key for an empty string key', () => {
      const result = t('')
      expect(result).toBe('')
    })

    describe('interpolation', () => {
      it('replaces {n} placeholder with a number', () => {
        const result = t('jira.daysActive', { n: 5 })
        expect(result).toBe('5d active')
      })

      it('replaces {n} placeholder with a string', () => {
        const result = t('time.hoursAgo', { n: '3' })
        expect(result).toBe('3h ago')
      })

      it('replaces multiple different placeholders', () => {
        const result = t('jira.updated', { ago: '2h ago' })
        expect(result).toBe('updated 2h ago')
      })

      it('replaces {time} placeholder in status.updated', () => {
        const result = t('status.updated', { time: '12:30' })
        expect(result).toBe('updated 12:30')
      })

      it('returns the string as-is when no params match placeholders', () => {
        const result = t('panel.prs', { nonexistent: 'value' })
        expect(result).toBe('active prs')
      })

      it('returns the string with placeholders intact when param not provided', () => {
        const result = t('jira.daysActive')
        expect(result).toBe('{n}d active')
      })

      it('replaces all occurrences of the same placeholder in jira.storyPoints', () => {
        const result = t('jira.storyPoints', { n: 8 })
        expect(result).toBe('SP: 8')
      })
    })
  })

  describe('setLanguage / getLanguage', () => {
    it('getLanguage() returns "en" by default', () => {
      expect(getLanguage()).toBe('en')
    })

    it('getLanguage() returns "es" after setLanguage("es")', () => {
      setLanguage('es')
      expect(getLanguage()).toBe('es')
    })

    it('setLanguage("es") changes t() translations to Spanish', () => {
      setLanguage('es')
      expect(t('app.title')).toBe('dev-dashboard')
      expect(t('header.loading')).toBe('cargando...')
    })

    it('setLanguage back to "en" restores English translations', () => {
      setLanguage('es')
      setLanguage('en')
      expect(t('header.loading')).toBe('loading...')
    })

    it('setLanguage with unsupported language is ignored', () => {
      setLanguage('fr')
      expect(getLanguage()).toBe('en')
      expect(t('header.loading')).toBe('loading...')
    })

    it('setLanguage persists to localStorage', () => {
      setLanguage('es')
      expect(localStorage.getItem('devdash_lang_v1')).toBe('es')
    })
  })

  describe('getAvailableLanguages', () => {
    it('returns at least "en" and "es"', () => {
      const langs = getAvailableLanguages()
      expect(langs).toContain('en')
      expect(langs).toContain('es')
    })
  })
})
