const messages = {
    // req message
    welcome: "歡迎使用診所候診小幫手！\n請輸入掛號診所雲端候診中心網址",
    reset: "已重置您的狀態！\n請輸入掛號診所雲端候診中心網址",
    requestNumber: "請輸入你的號碼",

    // error message
    invalidUrl: "請輸入正確的網址格式！\n請從頭開始重新輸入\n請輸入掛號診所雲端候診中心網址",
    invalidNumber: "請輸入正確的號碼格式！\n請從頭開始重新輸入\n請輸入掛號診所雲端候診中心網址",
    systemError: "系統發生錯誤，請稍後再試",
    nonBusinessHours: "目前非診所營業時間，請從頭開始重新輸入\n請輸入掛號診所雲端候診中心網址",
    
    // status message
    urlSaved: "已成功設定候診中心網址！\n請輸入您的掛號號碼",
    numberSaved: "已成功記錄您的號碼 ✅\n\n我會持續監控診所目前看診進度\n當快輪到您時會立即通知您\n\n如果需要重新設定，\n請輸入「重置」即可重新開始",
    
    // notification message
    missedNumber: (userNo, currentNo) => `您的號碼 ${userNo} 已經過號了！目前叫號：${currentNo}\n系統已重置，請重新輸入掛號診所雲端候診中心網址`,
    approaching: (currentNumber, userNumber) => `您的號碼即將到號！\n目前叫號：${currentNumber}\n您的號碼：${userNumber}`,
    currentNumber: (userNo) => `您的號碼 ${userNo} 已經到號了！\n系統已重置，請重新輸入掛號診所雲端候診中心網址`,
    missed: "您已錯過叫號！\n系統已自動重置，請重新設定",
};

module.exports = { messages };