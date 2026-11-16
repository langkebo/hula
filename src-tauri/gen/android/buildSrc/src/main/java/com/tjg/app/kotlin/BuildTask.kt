import java.io.File
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

open class BuildTask : DefaultTask() {
    @Input
    var rootDirRel: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        val executable = """pnpm""";
        try {
            runTauriCli(executable)
        } catch (e: Exception) {
            if (Os.isFamily(Os.FAMILY_WINDOWS)) {
                // Try different Windows-specific extensions
                val fallbacks = listOf(
                    "$executable.exe",
                    "$executable.cmd",
                    "$executable.bat",
                )
                
                var lastException: Exception = e
                for (fallback in fallbacks) {
                    try {
                        runTauriCli(fallback)
                        return
                    } catch (fallbackException: Exception) {
                        lastException = fallbackException
                    }
                }
                throw lastException
            } else {
                // PATCH（本仓改过；`tauri android init` 会覆盖本文件，重跑后需补回）：
                // `pnpm tauri android android-studio-script` 必须从父进程的 WebSocket 读 CLI 选项。
                // 在 Android Studio 里点 Run/Build 没有那个父进程 ⇒ exit 134
                // (`failed to read CLI options: failed to build WebSocket client: ConnectionRefused`)
                // ⇒ 整个 BUILD FAILED。回退到纯 cargo（scripts/android-rust-build.mjs）后 IDE 可直接构建。
                logger.lifecycle(
                    "[rust] tauri CLI 不可用（${e.message?.lineSequence()?.firstOrNull() ?: e}），" +
                        "回退到直接 cargo 构建 ${target ?: ""}"
                )
                runCargoFallback()
            }
        }
    }

    /**
     * 纯 cargo 兜底：等价于 CLI 在 IDE 会话里做的事（编 .so + 建 jniLibs 软链），
     * 细节（api26 工具链、CC/CXX、软链）都收在 scripts/android-rust-build.mjs 里。
     */
    private fun runCargoFallback() {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")

        // 注意 rootDirRel 指向的是 `src-tauri/`，而脚本在仓库根的 `scripts/` 下
        // （rootProject 是 `src-tauri/gen/android`，上溯三级才是仓库根），
        // 所以这里用**绝对路径**，不要拼相对路径。
        val projectRoot = File(project.rootProject.projectDir, "../../..").canonicalFile
        val script = File(projectRoot, "scripts/android-rust-build.mjs")
        if (!script.exists()) {
            throw GradleException("回退脚本不存在：${script.absolutePath}（tauri CLI 的 ws 不可用，且找不到 cargo 兜底入口）")
        }

        val args = mutableListOf(script.absolutePath, "--target", target)
        if (release) args.add("--release")

        project.exec {
            workingDir(File(project.projectDir, rootDirRel))
            environment("TAURI_PROJECT_ROOT", projectRoot.absolutePath)
            executable(nodeExecutable())
            args(args)
        }.assertNormalExitValue()
    }

    /**
     * 找 node：IDE 从 Dock 启动时 PATH 可能很干净，所以优先用已知绝对路径，
     * `NODE_BINARY` 环境变量可强制覆盖。
     */
    private fun nodeExecutable(): String {
        System.getenv("NODE_BINARY")?.takeIf { it.isNotBlank() }?.let { return it }
        val home = System.getProperty("user.home")
        return listOf(
            "/opt/homebrew/bin/node",
            "/opt/homebrew/opt/node@22/bin/node",
            "/usr/local/bin/node",
            "$home/.volta/bin/node",
        ).firstOrNull { File(it).canExecute() } ?: "node"
    }

    fun runTauriCli(executable: String) {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")
        val args = listOf("tauri", "android", "android-studio-script");

        project.exec {
            workingDir(File(project.projectDir, rootDirRel))
            executable(executable)
            args(args)
            if (project.logger.isEnabled(LogLevel.DEBUG)) {
                args("-vv")
            } else if (project.logger.isEnabled(LogLevel.INFO)) {
                args("-v")
            }
            if (release) {
                args("--release")
            }
            args(listOf("--target", target))
        }.assertNormalExitValue()
    }
}