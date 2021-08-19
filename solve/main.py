from z3 import *
import gen.core



core = gen.core.load()

s = Solver()

# mapping of element name to Sort.
elements = {}

aspects = {}


for element in core.elements:
    e = Sort(element.id) if not element.isAspect else Int(element.id)
    elements[element.id] = e
    if e.isAspect:
        aspects[element.id] = e

recipes = {}

for recipe in core.recipes:
    inputs = [(elements[k], v.number_value) for k, v in recipe.requirements.fields.items()]
    outputs = [(elements[k], v.number_value) for k, v in recipe.requirements.fields.items()]

    f = Function("recipe.%s" % (recipe.id), *inputs *outputs)

    recipes[recipe.id] = f
    s.add(


        



