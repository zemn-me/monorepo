from sympy import Quaternion, solve, symbols, Eq

centre = Quaternion(0, *symbols('c_i c_j c_k'))

# vector from centre upward
up = Quaternion(0, *symbols('u_i u_j u_k'))

forward = Quaternion(0, *symbols('fw_i fw_j fw_k'))

r_w, r_i, r_j, r_k = symbols('r_w r_i r_j r_k')

rotation = Quaternion(r_w, r_i, r_j, r_k)

look_at = Quaternion(0, *symbols('la_i la_j la_k'))

centre_does_not_rotate = Eq(centre * rotation, centre)

forward_will_look_at = Eq(
	(forward * rotation).normalize(),
	(centre - look_at).normalize()
)

up_will_still_be_up = Eq(
    (up * rotation),
	up
)

solve(
    [
		centre_does_not_rotate,
		forward_will_look_at,
		up_will_still_be_up
	], [
        rotation
	]
)

