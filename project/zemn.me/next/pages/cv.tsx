import { TimeEye } from 'project/zemn.me/elements/TimeEye';
import style from 'project/zemn.me/next/pages/cv.module.css';
import allowlist from 'ts/knowitwhenyouseeit';
import { useSearchParams } from 'next/navigation';

const phoneAllowlist = allowlist(
		"$2a$12$RVdyJIfBaUPKKoAEAT/n0OoQ18oj1UNyy12uYu24ZXhs4B0dtYV2K", // google voice
		"$2a$12$lwJiZLBm22VVGgIdkUgWmOIAV9MMSP3LWu4CSk9dj9OWbAsnlgMSG", // UK phone
		"$2a$12$qNXAxbbST7GxBvf5Havw2u1gBwgt58yxkNuz7f3Lr9ptNBJn9FjQu" // personal phone
	);

export function CV() {
	const candidatePhone = useSearchParams().get("phone") ?? "";
	// we do both because + becomes " " in query params.
	const phone = phoneAllowlist('+' + candidatePhone.replaceAll(/[^\d+]/g, ""));
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
