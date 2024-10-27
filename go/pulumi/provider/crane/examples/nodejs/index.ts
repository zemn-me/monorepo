import * as pulumi from "@pulumi/pulumi";
import * as crane from "@pulumi/crane";

const myRandomResource = new crane.Random("myRandomResource", {length: 24});
export const output = {
    value: myRandomResource.result,
};
