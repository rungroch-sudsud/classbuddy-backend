export class SmsMessageBuilder {
    private message: string = '';

    constructor() {}

    addText(text: string) {
        this.message += text;
        return this;
    }

    newLine() {
        this.message += '\n';
        return this;
    }

    getMessage() {
        return this.message;
    }
}
