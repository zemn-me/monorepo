import * as aws from "@pulumi/aws";
import * as pulumi from '@pulumi/pulumi';
import mime from "mime";

const file = (bucket: aws.s3.BucketObjectArgs["bucket"]) => (path: string) => new aws.s3.BucketObject(
    path,
    {
        key: path,
        bucket,
        contentType: mime.getType(path) || undefined,
        source: new pulumi.asset.FileAsset(path)
    }
);

const uploadContent = (bucket: aws.s3.BucketObjectArgs["bucket"]) => {
    let File = file(bucket);
    File('./index.html');
};

export const bucket = new aws.s3.Bucket("pleaseintroducemetoyour.dog", {
    acl: "public",
    website: {
        indexDocument: "index.html",
    },
});

uploadContent(bucket);

export default bucket;