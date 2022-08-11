import { artifact, release, npmPackage } from 'monorepo/deploy/releaser';

export default release(
	artifact(
		'recursive_vassals.zip',
		'//project/ck3/recursive-vassals/mod_zip.zip'
	),
	artifact(
		'recursive_vassals.patch',
		'//project/ck3/recursive-vassals/mod.patch'
	),
	artifact('svgshot.tar.gz', '//ts/cmd/svgshot/svgshot.tgz'),
	npmPackage('svgshot', '//ts/cmd/svgshot/npm_pkg.publish.sh')
);
