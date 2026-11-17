"""Project selected AWS Smithy operation bodies into encoding/xml Go structs.

This is deliberately a wire-type projection, not a Smithy server implementation.
Only the shape kinds and XML bindings used by the selected operations are accepted.
"""

import json

API = "smithy.api#"
SCALARS = {"string": "string", "boolean": "bool", "integer": "int32", "long": "int64"}
# These bindings belong to HTTP, rather than the XML document.
HTTP_BINDINGS = {
    API + name
    for name in (
        "httpHeader",
        "httpPrefixHeaders",
        "httpLabel",
        "httpQuery",
        "httpQueryParams",
        "httpResponseCode",
    )
}
XML_TRAITS = {API + name for name in ("xmlName", "xmlNamespace")}


def short_name(shape_id):
    return shape_id.split("#")[-1]


class Projection:
    def __init__(self, model, prefix):
        if model["smithy"] != "2.0":
            raise ValueError("Expected a Smithy 2.0 JSON model")
        self.shapes = model["shapes"]
        self.prefix = prefix
        self.definitions = {}
        self.roots = {}
        self.service = next(
            shape for shape in self.shapes.values() if shape["type"] == "service"
        )
        traits = self.service["traits"]
        self.namespace = traits[API + "xmlNamespace"]["uri"]
        if "aws.protocols#restXml" in traits:
            self.protocol = "restXml"
        elif "aws.protocols#ec2Query" in traits:
            self.protocol = "ec2Query"
        else:
            raise ValueError("Only restXml and ec2Query are supported")

    def go_name(self, shape_id):
        return self.prefix + short_name(shape_id)

    def check_xml_traits(self, shape):
        for trait in shape.get("traits", {}):
            if trait.startswith(API + "xml") and trait not in XML_TRAITS:
                raise ValueError(f"Unsupported XML trait: {trait}")

    def select(self, operation_name, direction):
        operation = next(
            shape
            for name, shape in self.shapes.items()
            if short_name(name) == operation_name
        )
        if operation["type"] != "operation" or direction not in ("input", "output"):
            raise ValueError("Expected an operation and input/output direction")
        if self.protocol == "ec2Query" and direction != "output":
            raise ValueError("EC2 Query inputs are form-encoded, not XML")
        shape_id = operation[direction]["target"]
        shape = self.shapes[shape_id]
        root = shape.get("traits", {}).get(API + "xmlName", short_name(shape_id))
        if self.protocol == "ec2Query":
            root = operation_name + "Response"
        namespace = (
            shape.get("traits", {})
            .get(API + "xmlNamespace", {})
            .get("uri", self.namespace)
        )
        root_binding = (namespace, root)
        if shape_id in self.roots and self.roots[shape_id] != root_binding:
            raise ValueError("One shape has conflicting operation roots")
        self.roots[shape_id] = root_binding

    def type_for(self, shape_id):
        shape = self.shapes.get(shape_id)
        if shape is None and shape_id.startswith("smithy.api#"):
            kind = short_name(shape_id).lower()
        else:
            kind = shape["type"]
            self.check_xml_traits(shape)
        if kind in SCALARS:
            return SCALARS[kind]
        if kind not in ("structure", "list"):
            raise ValueError(f"Unsupported shape: {shape_id} ({kind})")
        if shape_id in self.definitions:
            return self.go_name(shape_id)
        self.definitions[shape_id] = []
        fields = []
        if shape_id in self.roots:
            namespace, root = self.roots[shape_id]
            fields.append(("XMLName", "xml.Name", f"{namespace} {root}"))
        if kind == "list":
            member = shape["member"]
            self.check_xml_traits(member)
            name = member.get("traits", {}).get(API + "xmlName", "member")
            fields.append(("Items", "[]" + self.type_for(member["target"]), name))
        else:
            for name, member in shape.get("members", {}).items():
                self.check_xml_traits(member)
                traits = member.get("traits", {})
                if API + "httpPayload" in traits:
                    raise ValueError("HTTP payload bindings require a separate projection")
                field_type = self.type_for(member["target"])
                if HTTP_BINDINGS.intersection(traits):
                    binding = "-"
                else:
                    binding = traits.get(API + "xmlName", name)
                    namespace = traits.get(API + "xmlNamespace", {}).get("uri")
                    if namespace:
                        binding = namespace + " " + binding
                    if API + "required" not in traits:
                        field_type = "*" + field_type
                        binding += ",omitempty"
                fields.append((name[0].upper() + name[1:], field_type, binding))
        self.definitions[shape_id] = fields
        return self.go_name(shape_id)

    def render(self, package):
        for shape_id in self.roots:
            self.type_for(shape_id)
        lines = [
            "// Code generated from AWS Smithy models by //bzl/aws_xml:generate. DO NOT EDIT.",
            "",
            f"package {package}",
            "",
            'import "encoding/xml"',
            "",
        ]
        for shape_id, fields in sorted(self.definitions.items()):
            lines.extend(
                [
                    f"// {self.go_name(shape_id)} projects {shape_id}.",
                    f"type {self.go_name(shape_id)} struct {{",
                ]
            )
            for name, field_type, binding in fields:
                lines.append(f"\t{name} {field_type} `xml:{json.dumps(binding)}`")
            lines.extend(["}", ""])
        return "\n".join(lines)


def generate(model, prefix, selections, package="wire"):
    projection = Projection(model, prefix)
    for selection in selections:
        operation, direction = selection.split(":")
        projection.select(operation, direction)
    return projection.render(package)
