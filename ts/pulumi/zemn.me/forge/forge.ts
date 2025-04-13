import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

export interface GcpWorkstationArgs {
	location: pulumi.Input<string>;
	project?: pulumi.Input<string>;
}

export class GcpWorkstation extends pulumi.ComponentResource {
	constructor(
		name: string,
		args: GcpWorkstationArgs,
		opts?: pulumi.ComponentResourceOptions
	) {
		super("ts:pulumi:workstation", name, args, opts);

		const apiService = new gcp.projects.Service(`forgeapiservice`, {
			service: "workstations.googleapis.com",
			disableOnDestroy: false,
		}, { parent: this });

		const network = new gcp.compute.Network(`forgenetwork`, {
			autoCreateSubnetworks: false,
		}, { parent: this });

		const subnetwork = new gcp.compute.Subnetwork(`forgesubnet`, {
			ipCidrRange: "10.0.0.0/24",
			region: args.location,
			network: network.id,
		}, { parent: this });

		const cluster = new gcp.workstations.WorkstationCluster(`forgecluster`, {
			workstationClusterId: `${name}-cluster`,
			location: args.location,
			network: network.id,
			subnetwork: subnetwork.id,
		}, { parent: this, dependsOn: [ apiService ] });

		const config = new gcp.workstations.WorkstationConfig(`forgecluster`, {
			workstationConfigId: `${name}-config`,
			location: args.location,
			workstationClusterId: cluster.workstationClusterId,
			host: {
				gceInstance: {
					machineType: "e2-standard-4",
					bootDiskSizeGb: 50,
					disablePublicIpAddresses: true,
				}
			},
		}, { parent: this, dependsOn: [ apiService ] });

		const ws = new gcp.workstations.Workstation(`forgews`, {
			workstationId: `${name}-ws`,
			location: args.location,
			workstationClusterId: cluster.workstationClusterId,
			workstationConfigId: config.workstationConfigId,
		}, { parent: this, dependsOn: [ apiService ] });

		this.registerOutputs({ws});
	}
}
