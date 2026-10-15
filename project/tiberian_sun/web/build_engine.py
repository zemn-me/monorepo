"""Cross-compile the pinned engine and its dependencies in a Bazel action."""

import argparse
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tempfile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("config")
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    source = Path(config["source"]).absolute()
    overlay = Path(config["overlay"]).absolute()
    sdk = Path(config["compiler"]).absolute().parent.parent
    cmake = str(Path(config["cmake"]).absolute())
    ninja = str(Path(config["ninja"]).absolute())
    node = str(Path(config["node"]).absolute())
    outputs = [Path(value).absolute() for value in config["outputs"]]
    with tempfile.TemporaryDirectory(prefix="opents-web-") as temporary:
        work = Path(temporary)
        src = work / "source"
        shutil.copytree(source, src, ignore=shutil.ignore_patterns(".git", "archive", "dist", "tests", "manual"))
        shutil.copyfile(overlay / "CMakeLists.txt", src / "CMakeLists.txt")
        shutil.copyfile(overlay / "thirdparty.cmake", src / "thirdparty/CMakeLists.txt")
        (src / "web").mkdir(exist_ok=True)
        for name in ("platform.cpp", "platform.h", "network.cpp"):
            shutil.copyfile(overlay / name, src / "web" / name)
        shutil.copyfile(overlay / "webpeer.rml", src / "ui/webpeer.rml")
        # Emscripten's executables use env python3; keep the action on Bazel's interpreter.
        tools = work / "tools"
        tools.mkdir()
        (tools / "python3").symlink_to(sys.executable)
        emconfig = work / "emscripten.config"
        emconfig.write_text(
            f"LLVM_ROOT = {str(sdk / 'bin')!r}\n"
            f"BINARYEN_ROOT = {str(sdk)!r}\n"
            f"NODE_JS = [{node!r}]\n"
            f"CACHE = {str(sdk / 'emscripten/cache')!r}\n"
            "FROZEN_CACHE = True\n"
        )
        env = dict(os.environ, EM_CONFIG=str(emconfig))
        env["PATH"] = str(tools) + os.pathsep + env.get("PATH", "/usr/bin:/bin")
        generated = src / "generated"
        generated.mkdir()
        subprocess.run(
            [sys.executable, str(src / "platform/macos/generate_headers.py"), str(src), str(generated)],
            check=True, env=env,
        )
        build = work / "build"
        commands = [
            [cmake, "-S", str(src), "-B", str(build), "-G", "Ninja",
             f"-DCMAKE_MAKE_PROGRAM={ninja}",
             f"-DCMAKE_TOOLCHAIN_FILE={sdk / 'emscripten/cmake/Modules/Platform/Emscripten.cmake'}",
             "-DEMSCRIPTEN_SYSTEM_PROCESSOR=wasm32", "-DCMAKE_C_FLAGS=-msimd128", "-DCMAKE_BUILD_TYPE=Release"],
            [cmake, "--build", str(build), "--target", "opents", "-j", "4"],
        ]
        log = work / "build.log"
        with log.open("w") as stream:
            for command in commands:
                print(shlex.join(command), flush=True)
                result = subprocess.run(command, env=env, stdout=stream, stderr=subprocess.STDOUT)
                if result.returncode:
                    stream.flush()
                    print(log.read_text()[-24000:], file=sys.stderr)
                    raise SystemExit(result.returncode)
        for output in outputs:
            output.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(build / output.name, output)


if __name__ == "__main__":
    main()
