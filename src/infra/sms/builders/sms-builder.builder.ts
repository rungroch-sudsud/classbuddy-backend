export class SmsMessageBuilder {
    private message: string = '';

    constructor() {}

    addText(text: string) {
        this.message += text;
        return this;
    }

    newLine(numOfLines : number = 1) {
        this.message += '\n'.repeat(numOfLines);
        return this;
    }

    getMessage() {
        return this.message;
    }
}
