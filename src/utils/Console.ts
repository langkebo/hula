// biome-ignore-all lint/suspicious/noConsole: This helper exists specifically to print branded console output.
import pkg from '../../package.json'

/** 控制台打印版本信息 */
export const consolePrint = () => {
  console.log(
    `%c 🍀 ${pkg.name} ${pkg.version}`,
    'font-size:20px;border-left: 4px solid #13987f;background: #cef9ec;font-family: Comic Sans MS, cursive;color:#581845;padding:10px;border-radius:4px;',
    `${pkg.author.email}`
  )
}
