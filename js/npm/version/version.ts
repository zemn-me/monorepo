import * as npm from 'js/npm';
import axios from 'axios';

export async function latest(pkg: npm.PackageName) {
    const { version } = JSON.parse(await axios.get(
        `https://registry.npmjs.org/${pkg}/latest`))
    
    return version;
}