const styles = new Proxy(
	{},
	{
		get: (_target, property) => String(property),
	}
);

export default styles;

