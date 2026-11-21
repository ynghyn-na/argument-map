const demoText = "보행자가 많은 캠퍼스 중앙도로에서는 자전거 통행을 제한해야 한다. 지난달 중앙도로에서 보행자와 자전거가 부딪히는 사고 세 건이 접수됐다. 수업이 끝나는 시간에는 보행자와 자전거의 이동 경로가 겹친다.\n\n한편 자전거로 통학하는 학생들은 통행 제한으로 이동 시간이 늘어날 수 있다고 우려한다. 우회로를 안내하는 방법도 함께 검토할 필요가 있다.";
export const demo = {
  status: "ok",
  title: "캠퍼스 중앙도로의 자전거 통행을 제한하자",
  extracted_text: demoText,
  reading_note: "기능 확인용 가상 예시입니다. 아래 지도는 미리 작성한 예시 데이터입니다.",
  nodes: [
    {id: "C1", type: "claim", origin: "original", text: "보행자가 많은 중앙도로의 자전거 통행을 제한해야 한다.", source_quote: "보행자가 많은 캠퍼스 중앙도로에서는 자전거 통행을 제한해야 한다."},
    {id: "E1", type: "reason", origin: "original", text: "지난달 보행자와 자전거의 충돌 사고 세 건이 접수됐다.", source_quote: "지난달 중앙도로에서 보행자와 자전거가 부딪히는 사고 세 건이 접수됐다."},
    {id: "E2", type: "reason", origin: "original", text: "수업이 끝나는 시간에는 이동 경로가 겹친다.", source_quote: "수업이 끝나는 시간에는 보행자와 자전거의 이동 경로가 겹친다."},
    {id: "O1", type: "objection", origin: "original", text: "자전거 통학 학생의 이동 시간이 늘어날 수 있다.", source_quote: "한편 자전거로 통학하는 학생들은 통행 제한으로 이동 시간이 늘어날 수 있다고 우려한다."},
    {id: "Q1", type: "review", origin: "ai", text: "사고 건수와 함께 전체 통행량과 이전 기간의 사고율도 확인해야 하지 않을까?", source_quote: ""},
  ],
  edges: [
    {source: "E1", target: "C1", relation: "supports"},
    {source: "E2", target: "C1", relation: "supports"},
    {source: "O1", target: "C1", relation: "challenges"},
    {source: "Q1", target: "E1", relation: "challenges"},
  ],
};
