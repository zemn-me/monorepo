#!/usr/bin/env python3

import os

from inject_iservice import main


if __name__ == "__main__":
    os.environ["ZEMN_ITEST_ENV"] = "prod"
    main()
