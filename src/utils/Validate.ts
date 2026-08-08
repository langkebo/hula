export const validateSpecialChar = (value: string, patten = /[!@#¥$%.&*^()_+=\-~]/) => patten.test(value)

export const validateAlphaNumeric = (value: string) => {
  const hasLetter = /[a-zA-Z]/.test(value)
  const hasNumber = /[0-9]/.test(value)
  return hasLetter && hasNumber
}
