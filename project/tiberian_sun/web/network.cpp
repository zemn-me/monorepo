// SPDX-License-Identifier: GPL-3.0-or-later
#include "always.h"
#include "netsocket.h"
#include "dbgprint.h"
#include "ui/rml/rmlview.h"
#include "ui/uienginehost.h"
#include "ui/uishell.h"
#include <RmlUi/Core/Context.h>
#include <RmlUi/Core/ElementDocument.h>
#include <cstdlib>
#include <cstring>

EM_JS(int, Peer_Host, (), { return Module.webNetwork.state.host; });
EM_JS(int, Peer_Connected, (), { return Module.webNetwork.state.connected; });
EM_JS(void, Peer_Reset, (), { Module.webNetwork.reset(); });
EM_JS(void, Peer_Action, (const char *action, const char *text), {
    Module.webNetwork.perform(UTF8ToString(action), UTF8ToString(text));
});
EM_JS(char *, Peer_Text, (const char *field), {
    const key = UTF8ToString(field);
    const text = Module.webNetwork.state[key] || '';
    if (key === 'pasted') Module.webNetwork.state.pasted = '';
    return stringToNewUTF8(text);
});
EM_JS(void, Peer_Copy, (), {
    navigator.clipboard.writeText(Module.webNetwork.state.code).catch(() => {
        Module.webNetwork.state.status = 'Copy failed. Select the code and copy it manually.';
    });
});
EM_JS(void, Peer_Paste, (), {
    navigator.clipboard.readText().then(text => { Module.webNetwork.state.pasted = text; }).catch(() => {
        Module.webNetwork.state.status = 'Paste permission denied. Use Ctrl+V or Command+V to paste your code.';
    });
});
EM_JS(int, Peer_Send, (const void *bytes, int length), {
    return Module.webNetwork.send(HEAPU8.slice(bytes, bytes + length));
});
EM_JS(int, Peer_Receive, (void *buffer, int length), {
    const bytes = Module.webNetwork.receive();
    if (!bytes) return 0;
    if (bytes.length > length) return -1;
    HEAPU8.set(bytes, buffer);
    return bytes.length;
});

namespace {
uint32_t Address(bool host) {
    const unsigned char bytes[] = {10, 0, 0, static_cast<unsigned char>(host ? 1 : 2)};
    uint32_t ip;
    std::memcpy(&ip, bytes, sizeof(ip));
    return ip;
}
class WebRTCSocketClass : public SocketClass {
    bool Opened = false;
    uint16_t Port = 0;
public:
    bool Open(unsigned short port) override { Port = Socket_Network_Port(port); Opened = Peer_Connected(); return Opened; }
    void Close() override { Opened = false; }
    bool Is_Open() const override { return Opened; }
    bool Set_Broadcast(bool) override { return true; }
    bool Set_Buffer_Sizes(int, int) override { return true; }
    void Clear_Error() override {}
    TransferResult Send_To(void const *buffer, int length, IPXAddressClass const &to) override {
        if (!Opened || length <= 0 || length > 1536) return {SocketError::OTHER, 0};
        if (!to.Is_Broadcast() && to.Get_IP() != Address(!Peer_Host())) return {SocketError::NONE, length};
        return Peer_Send(buffer, length) ? TransferResult{SocketError::NONE, length} : TransferResult{SocketError::WOULD_BLOCK, 0};
    }
    TransferResult Receive_From(void *buffer, int length, IPXAddressClass &from) override {
        if (!Opened) return {SocketError::OTHER, 0};
        const int count = Peer_Receive(buffer, length);
        if (count == 0) return {SocketError::WOULD_BLOCK, 0};
        if (count < 0) return {SocketError::MESSAGE_SIZE, 0};
        from.Set_Address(Address(!Peer_Host()), Port);
        return {SocketError::NONE, count};
    }
    bool Local_Interfaces(std::vector<InterfaceType> &interfaces) override {
        interfaces.push_back({Address(Peer_Host()), 0xffffffff});
        return true;
    }
};
std::string Text(char const *field) {
    char *raw = Peer_Text(field);
    std::string value = raw;
    std::free(raw);
    return value;
}
class PeerPresenter : public UIPresenterClass {
public:
    std::string Status, Code, Input;
    void Execute(UIIntent const &intent) override {
        if (intent.Name == "invite" || intent.Name == "accept") Peer_Action(intent.Name.c_str(), Input.c_str());
        else if (intent.Name == "input") Input = intent.Text;
        else if (intent.Name == "copy") Peer_Copy();
        else if (intent.Name == "paste") Peer_Paste();
        else if (intent.Name == "continue" && Peer_Connected()) Result = UI_RESULT_ACCEPTED;
        else if (intent.Name == "cancel") Result = UI_RESULT_CANCELLED;
    }
    void Refresh() override {
        std::string status = Text("status");
        if (status != Status) DebugString("Internet: %s\n", status.c_str());
        Status = std::move(status);
        Code = Text("code");
        std::string pasted = Text("pasted");
        if (!pasted.empty()) Input = pasted;
    }
};
class PeerView : public UIRmlViewClass {
    PeerPresenter &Data;
public:
    explicit PeerView(PeerPresenter &data) : UIRmlViewClass(data, "webpeer.rml", "webpeer"), Data(data) {}
    bool Bind(Rml::DataModelConstructor &model) override {
        return model.Bind("status", &Data.Status) && model.Bind("code", &Data.Code) && model.Bind("input", &Data.Input);
    }
    void Sync() override { Model.DirtyAllVariables(); }
};
}
std::unique_ptr<SocketClass> Socket_Create_Platform_Socket() { return std::make_unique<WebRTCSocketClass>(); }

bool Web_Connect_Peer() {
    Peer_Reset();
    EM_ASM({ Module.webNetwork.state.active = true; });
    PeerPresenter presenter;
    PeerView view(presenter);
    const auto result = UI_Run_Modal(view);
    EM_ASM({ Module.webNetwork.state.active = false; });
    if (result != UI_RESULT_ACCEPTED) Peer_Reset();
    return result == UI_RESULT_ACCEPTED;
}
