import { TimeEye } from 'project/zemn.me/elements/TimeEye';
import style from 'project/zemn.me/next/pages/cv.module.css';
import allowlist from 'ts/knowitwhenyouseeit';
import { useSearchParams } from 'next/navigation';

const phoneAllowlist = allowlist(
		"$2a$12$ndt.rvXtqucZF4/mxcgGMuxcR5Y1ehc.E9FCjSEpflxb5MGdFZWc6", // google voice
		"$2a$12$LdEey1b8EnWI1KtC8ra9dOuRjK.d63Xu5JebyuD8Q4WIS9e5Z2ZQS", // UK phone
		"$2a$12$qNXAxbbST7GxBvf5Havw2u1gBwgt58yxkNuz7f3Lr9ptNBJn9FjQu" // personal phone
	);

export function CV() {
	const candidatePhone = useSearchParams().get("phone") ?? "";
	// we do both because + becomes " " in query params.
	const phone = phoneAllowlist(candidatePhone) ?? phoneAllowlist(candidatePhone.replaceAll(" ", "+"));
	return <main className={style.cv}>
		<a className={style.website} href="https://zemn.me">zemn.me</a>
		<TimeEye className={style.thomasLogo}/>
		<a className={style.emailAddress} href="mailto:thomas@shadwell.im">thomas@shadwell.im</a>
		{
			phone !== false
				? <a className={style.phoneNumber} href={`tel:${phone}`}>{phone}</a>
				: null
		}
	</main>
}

export default CV;
