from project.cultist.gen.core_pb2 import Core
from google.protobuf import json_format

def load() -> Core:
    o = Core()
    with open('gen/core_en.json', 'r') as corejson:
        json_format.Parse(corejson.read(), o)
    return o
