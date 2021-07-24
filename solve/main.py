import json
from z3 import *



def getCore():
    with open("gen/core_en.json") as core:
        return json.load(core)



data = getCore()

PreErudition = DeclareSort('PreErudition')
PreEruditionDecay = Function('PreEruditionDecay', PreErudition)
