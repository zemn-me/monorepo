from bzl.versioning.release_lib import parser


if __name__ == "__main__":
    args = parser().parse_args()
    args.run(args)
