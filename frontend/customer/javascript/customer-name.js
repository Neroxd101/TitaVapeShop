// Shared by customer forms and the backend; names with spaces remain intact.
const invalidNameCharacter = /[^\p{L}\p{M} .'’\p{Pd}]/u;
const invalidNameCharacters = new RegExp(invalidNameCharacter.source, 'gu');

const CustomerName = {
  keys: ['last_name', 'first_name', 'middle_name', 'suffix'],
  ids: ['LastName', 'FirstName', 'MiddleName', 'Suffix'],
  registrationLimits: { first_name: 25, last_name: 25, middle_name: 25, suffix: 5 },
  normalize(parts, limits = {}, { validateCharacters = true } = {}) {
    if (!parts || typeof parts !== 'object' || Array.isArray(parts)) throw new Error('Please enter your last name and first name.');
    const result = {};
    this.keys.forEach((key, index) => {
      const value = parts[key] === undefined ? '' : parts[key];
      if (typeof value !== 'string') throw new Error('Name fields must be text.');
      result[key] = value.trim();
      const label = this.ids[index].replace('Name', ' name');
      if (validateCharacters && invalidNameCharacter.test(result[key])) {
        throw new Error(`${label} can only contain letters, spaces, apostrophes, hyphens, and periods.`);
      }
      const limit = limits[key] ?? (key === 'suffix' ? 20 : 100);
      if (result[key].length > limit) {
        throw new Error(`${label} must be ${limit} characters or fewer.`);
      }
    });
    if (!result.last_name || !result.first_name) throw new Error('Please enter your last name and first name.');
    if (`${result.last_name}, ${[result.first_name, result.middle_name, result.suffix].filter(Boolean).join(' ')}`.length > 255) {
      throw new Error('Your full name must not exceed 255 characters.');
    }
    return result;
  },
  format(parts) {
    const clean = this.normalize(parts, {}, { validateCharacters: false });
    return `${clean.last_name}, ${[clean.first_name, clean.middle_name, clean.suffix].filter(Boolean).join(' ')}`;
  },
  read(prefix) {
    const parts = Object.fromEntries(this.keys.map((key, index) => [key, document.getElementById(prefix + this.ids[index])?.value || '']));
    return this.normalize(parts, prefix === 'customerReg' ? this.registrationLimits : undefined);
  },
  bindInputs(prefix) {
    this.ids.forEach((id) => {
      const input = document.getElementById(prefix + id);
      if (!input) return;
      const filter = () => {
        const value = input.value;
        const cleaned = value.replace(invalidNameCharacters, '');
        if (value === cleaned) return;
        const start = value.slice(0, input.selectionStart).replace(invalidNameCharacters, '').length;
        const end = value.slice(0, input.selectionEnd).replace(invalidNameCharacters, '').length;
        input.value = cleaned;
        input.setSelectionRange(start, end);
      };
      input.addEventListener('input', (event) => {
        if (!event.isComposing) filter();
      });
      input.addEventListener('compositionend', filter);
    });
  },
  populate(prefix, user) {
    // Never guess how an older free-text name divides into first/middle/last names.
    this.keys.forEach((key, index) => {
      const input = document.getElementById(prefix + this.ids[index]);
      if (input) input.value = user?.name_parts?.[key] || '';
    });
    const legacy = document.getElementById(prefix + 'LegacyName');
    if (legacy) {
      legacy.hidden = !!user?.name_parts || !user?.full_name;
      legacy.textContent = `Saved name: ${user?.full_name || ''}. Please enter the separate name fields to update it.`;
    }
  }
};
if (typeof module !== 'undefined' && module.exports) module.exports = CustomerName;
if (typeof window !== 'undefined') window.CustomerName = CustomerName;
