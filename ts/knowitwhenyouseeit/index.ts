import bcrypt from 'bcryptjs';

export default (...bcrypt_digests) =>
  (input) => bcrypt_digests.some(digest => bcrypt.compareSync(input, digest)) && input;
