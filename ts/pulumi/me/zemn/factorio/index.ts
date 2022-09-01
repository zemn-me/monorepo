import * as aws from '@pulumi/aws';
import fs from 'fs/promises';
import * as pulumi from '@pulumi/pulumi';
import { zone } from 'monorepo/ts/pulumi/me/zemn/zone';

//import * as command from '@pulumi/command';

export const ami = aws.ec2.getAmi({
	mostRecent: true,
	// magic number from https://ubuntu.com/server/docs/cloud-images/amazon-ec2
	owners: ['679593333241'],
	filters: [
		{
			name: 'architecture',
			values: ['x86_64'],
		},
		{
			name: 'description',
			values: ['*LTS*'],
		},
		{
			name: 'description',
			values: ['*Ubuntu*'],
		},
		{
			name: 'virtualization-type',
			values: ['hvm'],
		},
	],
});

const factorioPorts = [
	{
		protocol: 'udp',
		fromPort: 34197,
		toPort: 34197,
		cidrBlocks: ['0.0.0.0/0'],
	},
	{
		protocol: 'tcp',
		fromPort: 27015,
		toPort: 27015,
		cidrBlocks: ['0.0.0.0/0'],
	},
];

export const securityGroup = new aws.ec2.SecurityGroup(
	'factorio-server-security-group',
	{
		ingress: [...factorioPorts],
	}
);

export const startupScript = new pulumi.asset.FileAsset(
	'ts/pulumi/me/zemn/factorio/startupScript.sh'
);
export const defaultSaveFile = new pulumi.asset.FileAsset(
	'ts/pulumi/me/zemn/factorio/map.zip'
);

export const factorioData = new aws.ebs.Volume('factorio-server-data', {
	availabilityZone: 'us-east-1',
	size: 2,
});

export const ec2 = new aws.ec2.Instance('factorio-server', {
	ami: ami.then(ami => ami.id),
	// should be burstable https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-performance-instances.html
	instanceType: 't3.medium',
	tags: {
		CreatedBy: 'monorepo / pulumi',
		Game: 'Factorio',
	},
	vpcSecurityGroupIds: [securityGroup.id],
	userData: startupScript.path.then(async path =>
		(await fs.readFile(path)).toString('utf-8')
	),
});

export const factorioDataMount = new aws.ec2.VolumeAttachment(
	'factorio-server-data-mount',
	{
		deviceName: '/dev/sdh',
		volumeId: factorioData.id,
		instanceId: ec2.id,
	}
);

export const cname: aws.route53.Record = new aws.route53.Record(
	'cname_factorio.zemn.me',
	{
		name: pulumi.interpolate`factorio.${zone.name}`,
		zoneId: zone.zoneId,
		type: 'CNAME',
		records: [ec2.publicDns],
	}
);

/*
Could try copying the save file over from s3 or something with this.
export const fileCopy = new command.remote.CopyFile("factorio-save-file", {
    localPath: defaultSaveFile.path,
    remotePath: '/opt/factorio/saves',
    connection: {
        host: ec2.publicDns,
    }
})
*/
