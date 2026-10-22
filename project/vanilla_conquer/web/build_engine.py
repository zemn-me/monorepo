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


def run_commands(commands, env, log):
    """Keep successful action output private; replay diagnostics on failure."""
    with log.open("w") as stream:
        for command in commands:
            print(shlex.join(command), file=stream, flush=True)
            result = subprocess.run(command, env=env, stdout=stream, stderr=subprocess.STDOUT)
            if result.returncode:
                stream.flush()
                print(log.read_text()[-24000:], file=sys.stderr)
                raise SystemExit(result.returncode)


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
    with tempfile.TemporaryDirectory(prefix="vanilla-web-") as temporary:
        work = Path(temporary)
        src = work / "source"
        shutil.copytree(source, src, ignore=shutil.ignore_patterns(".git", "archive", "dist", "tests", "manual"))
        shutil.copytree(Path(config["sdl"]).absolute(), src / "sdl2")
        for name in ("FindSDL2.cmake", "FindOpenAL.cmake", "Web.cmake"):
            shutil.copyfile(overlay / name, src / "cmake" / name)
        with (src / "CMakeLists.txt").open("a") as stream:
            stream.write('\ninclude(cmake/Web.cmake)\n')
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
        # Dependencies use __DATE__/__TIME__ in compiled diagnostics. A fixed epoch
        # keeps unchanged source independent of the wall clock.
        env = dict(os.environ, EM_CONFIG=str(emconfig), SOURCE_DATE_EPOCH="0")
        env["PATH"] = str(tools) + os.pathsep + env.get("PATH", "/usr/bin:/bin")
        generated = src / "generated"
        generated.mkdir()
        build = work / "build"
        # Assertions and source_location embed __FILE__, even in release builds.
        # Remap source/SDK paths and the working directory recorded in DWARF.
        # Clang records its compilation directory separately from file-prefix maps.
        prefix_maps = shlex.join([
            f"-ffile-prefix-map={work}=/vanilla",
            f"-ffile-prefix-map={sdk}=/emsdk",
            "-fdebug-compilation-dir=/vanilla/build",
        ])
        commands = [
            [cmake, "-S", str(src), "-B", str(build), "-G", "Ninja",
             f"-DCMAKE_MAKE_PROGRAM={ninja}",
             f"-DCMAKE_TOOLCHAIN_FILE={sdk / 'emscripten/cmake/Modules/Platform/Emscripten.cmake'}",
             "-DEMSCRIPTEN_SYSTEM_PROCESSOR=wasm32",
             f"-DCMAKE_C_FLAGS={prefix_maps}",
             f"-DCMAKE_CXX_FLAGS={prefix_maps}", "-DCMAKE_BUILD_TYPE=Release",
             "-DNETWORKING=OFF", "-DSDL_SHARED=OFF", "-DSDL_STATIC=ON",
             "-DSDL_TEST=OFF", "-DSDL2_DISABLE_INSTALL=ON"],
            [cmake, "--build", str(build), "--target", "VanillaRA" if config["game"] == "vanillara" else "VanillaTD", "-j", "4"],
        ]
        log = work / "build.log"
        run_commands(commands, env, log)
        for output in outputs:
            output.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(build / output.name, output)


if __name__ == "__main__":
    main()
