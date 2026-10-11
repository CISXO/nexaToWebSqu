// [DEMO] 가상 마스킹 샘플 (사내 소스 아님)
// 주석 속 호출은 검출되면 안 됨: ds_main.getRowCount()
var gbl_cnt = 0;

function fnInit() {
    var cnt = ds_main.getRowCount();
    var msg = "건수: ds_main.getRowCount() 입니다";
    /* 블록 주석 시작
       dlt_list.demoAddRow();
    */
    dlt_list.demoAddRow();
    fnLocalHelper(cnt);
    return cnt;
}

function fnSave() {
    dma_form.demoSetCol(0, "NAME", "abc"); // dma_form.demoClear()
    dlt_list.demoClear();
    var n = dma_result.getCount();
    var txt = 'demoAddRow: ' + "dlt_list.demoAddRow()";
    var tpl = `템플릿 ${n} dlt_list.demoClear()`;
    if (ds_main.getRowCount() > 0 &&
        ds_sub.getRowCount() > 0) {
        gbl_cnt = ds_main
            .getRowCount();
    }
    return gbl_cnt;
}

function fnEtc() {
    var a = getRowCount(0);
    var b = ds_main.getRowCounts();
    var c = ds_main.getRowCount;
    var d = ds_main.xgetRowCount();
    var e = arr[0].demoAddRow(1);
    this.demoAddRow();
    return a + b + c + d + e;
}

var z = ds_main . getRowCount ( );
var y = dma_form.demoGetCol(0, "NAME");
