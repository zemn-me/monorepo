from sympy import Quaternion, solve, symbols, Eq

centre = Quaternion(0, *symbols('c_i c_j c_k', real=True))

# vector from centre upward
up = Quaternion(0, *symbols('u_i u_j u_k', real=True))

forward = Quaternion(0, *symbols('fw_i fw_j fw_k', real=True))

r_w, r_i, r_j, r_k = symbols('r_w r_i r_j r_k', real=True)

rotation = Quaternion(r_w, r_i, r_j, r_k)

look_at = Quaternion(0, *symbols('la_i la_j la_k', real=True))

centre_does_not_rotate = Eq(centre * rotation, centre)

forward_will_look_at = Eq(
	((centre - forward) * rotation).normalize(),
	(centre - look_at).normalize()
)

length_of_forward_unchanged = Eq(
	(forward-centre).norm(),
    ((forward * rotation) - centre).norm()
)

up_will_still_be_up = Eq(
    (up * rotation),
	up
)

solve(
    [
		length_of_forward_unchanged,
		centre_does_not_rotate,
		forward_will_look_at,
		up_will_still_be_up
	], [
        r_w, r_i, r_j, r_k
	]
)
