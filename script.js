async function loadATCHData() {

    try {

        const response =
            await fetch("./data/atch_data.json");

        if (!response.ok) {
            throw new Error(
                "ATCH 데이터를 불러오지 못했습니다."
            );
        }

        const data =
            await response.json();

        updateDashboard(data);

    } catch (error) {

        console.error(error);

    }
}
function updateDashboard(data) {

    document.getElementById(
        "current-price"
    ).textContent =
        `$${data.current_price.toFixed(4)}`;

    document.getElementById(
        "predicted-price"
    ).textContent =
        `$${data.predicted_price.toFixed(4)}`;

    document.getElementById(
        "expected-change"
    ).textContent =
        `${data.expected_change.toFixed(2)}%`;

    document.getElementById(
        "signal"
    ).textContent =
        data.signal;

    document.getElementById(
        "updated-at"
    ).textContent =
        data.updated_at;

}
loadATCHData();
