

const cmp = () => <div style={{
    display: "grid",
    gridAutoColumns: "1fr 1fr"
}}>
    <code><pre>{`
window.addEventListener("message", e => {
    console.log("RCV", e);

    // we need to wait for the null page to postMessage
    // us to tell us it exists. This way of doing it
    // is ... not entirely kosher but it works for our
    // purposes.
    if (e.data == "ready") return nullPage.postMessage(config, "*");
`}</pre></code> <div><p>Hello!</p></div>
</div>

export default cmp;