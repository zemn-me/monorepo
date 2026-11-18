package wire

import (
	"encoding/xml"
	"testing"
)

func TestRoute53RequestNamespaceAndEscaping(t *testing.T) {
	var request Route53CreateQueryLoggingConfigRequest
	err := xml.Unmarshal([]byte(`<r:CreateQueryLoggingConfigRequest xmlns:r="https://route53.amazonaws.com/doc/2013-04-01/"><r:HostedZoneId>Z123</r:HostedZoneId><r:CloudWatchLogsLogGroupArn>arn:logs:a&amp;b</r:CloudWatchLogsLogGroupArn></r:CreateQueryLoggingConfigRequest>`), &request)
	if err != nil {
		t.Fatal(err)
	}
	if request.HostedZoneId != "Z123" || request.CloudWatchLogsLogGroupArn != "arn:logs:a&b" {
		t.Fatalf("unexpected request: %+v", request)
	}
	if err := xml.Unmarshal([]byte(`<CreateQueryLoggingConfigRequest xmlns="wrong"/>`), &request); err == nil {
		t.Fatal("accepted an incorrect namespace")
	}
}

func TestRoute53ResponseExcludesHTTPHeader(t *testing.T) {
	response := Route53CreateQueryLoggingConfigResponse{
		QueryLoggingConfig: Route53QueryLoggingConfig{Id: "id", HostedZoneId: "zone", CloudWatchLogsLogGroupArn: "arn:logs:a&b"},
		Location:           "/2013-04-01/queryloggingconfig/id",
	}
	data, err := xml.Marshal(response)
	if err != nil {
		t.Fatal(err)
	}
	const expected = `<CreateQueryLoggingConfigResponse xmlns="https://route53.amazonaws.com/doc/2013-04-01/"><QueryLoggingConfig><Id>id</Id><HostedZoneId>zone</HostedZoneId><CloudWatchLogsLogGroupArn>arn:logs:a&amp;b</CloudWatchLogsLogGroupArn></QueryLoggingConfig></CreateQueryLoggingConfigResponse>`
	if string(data) != expected {
		t.Fatalf("unexpected XML: %s", data)
	}
}

func TestS3ControlListMemberName(t *testing.T) {
	response := S3ControlListTagsForResourceResult{Tags: &S3ControlTagList{Items: []S3ControlTag{{Key: "key", Value: "value"}}}}
	data, err := xml.Marshal(response)
	if err != nil {
		t.Fatal(err)
	}
	const expected = `<ListTagsForResourceResult xmlns="http://awss3control.amazonaws.com/doc/2018-08-20/"><Tags><Tag><Key>key</Key><Value>value</Value></Tag></Tags></ListTagsForResourceResult>`
	if string(data) != expected {
		t.Fatalf("unexpected XML: %s", data)
	}
}

func TestS3ControlAbsentAndEmptyLists(t *testing.T) {
	absent, err := xml.Marshal(S3ControlListTagsForResourceResult{})
	if err != nil {
		t.Fatal(err)
	}
	const absentXML = `<ListTagsForResourceResult xmlns="http://awss3control.amazonaws.com/doc/2018-08-20/"></ListTagsForResourceResult>`
	if string(absent) != absentXML {
		t.Fatalf("unexpected absent list: %s", absent)
	}
	empty, err := xml.Marshal(S3ControlListTagsForResourceResult{Tags: &S3ControlTagList{}})
	if err != nil {
		t.Fatal(err)
	}
	const emptyXML = `<ListTagsForResourceResult xmlns="http://awss3control.amazonaws.com/doc/2018-08-20/"><Tags></Tags></ListTagsForResourceResult>`
	if string(empty) != emptyXML {
		t.Fatalf("unexpected empty list: %s", empty)
	}
}

func TestEC2ResponseRootAndLowercaseMember(t *testing.T) {
	succeeded := true
	data, err := xml.Marshal(EC2AuthorizeSecurityGroupEgressResult{Return: &succeeded})
	if err != nil {
		t.Fatal(err)
	}
	const expected = `<AuthorizeSecurityGroupEgressResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15"><return>true</return></AuthorizeSecurityGroupEgressResponse>`
	if string(data) != expected {
		t.Fatalf("unexpected XML: %s", data)
	}
}

func TestEC2NestedListAndOptionalScalar(t *testing.T) {
	protocol := "tcp"
	permission := EC2IpPermission{IpProtocol: &protocol}
	response := EC2RevokeSecurityGroupEgressResult{UnknownIpPermissions: &EC2IpPermissionList{Items: []EC2IpPermission{permission}}}
	data, err := xml.Marshal(response)
	if err != nil {
		t.Fatal(err)
	}
	const expected = `<RevokeSecurityGroupEgressResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15"><unknownIpPermissionSet><item><ipProtocol>tcp</ipProtocol></item></unknownIpPermissionSet></RevokeSecurityGroupEgressResponse>`
	if string(data) != expected {
		t.Fatalf("unexpected XML: %s", data)
	}
}
