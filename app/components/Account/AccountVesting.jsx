import React from "react";
import Translate from "react-translate-component";
import FormattedAsset from "../Utility/FormattedAsset";
import {ChainStore} from "bitsharesjs";
import utils from "common/utils";
import WalletActions from "actions/WalletActions";
import {Apis} from "bitsharesjs-ws";
import {Tabs, Tab} from "../Utility/Tabs";
import LoadingIndicator from "components/LoadingIndicator";

class VestingBalance extends React.Component {
    constructor() {
        super();

        this._updateState = this._updateState.bind(this);
    }

    componentWillMount() {
        this._updateState();

        ChainStore.subscribe(this._updateState);
    }

    componentWillUnmount() {
        ChainStore.unsubscribe(this._updateState);
    }

    _updateState() {
        let {vb} = this.props;
        const cvbAsset = ChainStore.getAsset(vb.balance.asset_id);
        this.setState({cvbAsset});
    }
    _onClaim(claimAll, e) {
        e.preventDefault();
        WalletActions.claimVestingBalance(
            this.props.account.id,
            this.props.vb,
            claimAll
        ).then(() => {
            typeof this.props.handleChanged == "function" &&
                this.props.handleChanged();
        });
    }

    render() {
        let {vb} = this.props;
        const {cvbAsset} = this.state;
        if (!this.props.vb) {
            return null;
        }

        let secondsPerDay = 60 * 60 * 24,
            balance;
        let vestingPeriod = null;
        let earned = null;
        let availablePercent = null;
        if (vb) {
            balance = vb.balance.amount;

            if (vb.policy && vb.policy[0] !== 2) {
                earned = vb.policy[1].coin_seconds_earned;
                vestingPeriod = vb.policy[1].vesting_seconds;
                availablePercent =
                    vestingPeriod === 0
                        ? 1
                        : earned / (vestingPeriod * balance);
            }
        }

        if (!balance) {
            return null;
        }

        return (
            <div>
                <Translate
                    component="h5"
                    content="account.vesting.balance_number"
                    id={vb.id}
                />

                {cvbAsset ? (
                    <table className="table key-value-table">
                        <tbody>
                            <tr>
                                <td>
                                    <Translate content="account.member.balance_type" />
                                </td>
                                <td>
                                    <span>{vb.balance_type}</span>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="account.member.cashback" />
                                </td>
                                <td>
                                    <FormattedAsset
                                        amount={vb.balance.amount}
                                        asset={vb.balance.asset_id}
                                    />
                                </td>
                            </tr>
                            {earned && (
                                <tr>
                                    <td>
                                        <Translate content="account.member.earned" />
                                    </td>
                                    <td>
                                        {cvbAsset
                                            ? utils.format_number(
                                                  utils.get_asset_amount(
                                                      earned / secondsPerDay,
                                                      cvbAsset
                                                  ),
                                                  0
                                              )
                                            : null}
                                        &nbsp;
                                        <Translate content="account.member.coindays" />
                                    </td>
                                </tr>
                            )}
                            {earned && (
                                <tr>
                                    <td>
                                        <Translate content="account.member.required" />
                                    </td>
                                    <td>
                                        {cvbAsset
                                            ? utils.format_number(
                                                  utils.get_asset_amount(
                                                      (vb.balance.amount *
                                                          vestingPeriod) /
                                                          secondsPerDay,
                                                      cvbAsset
                                                  ),
                                                  0
                                              )
                                            : null}
                                        &nbsp;
                                        <Translate content="account.member.coindays" />
                                    </td>
                                </tr>
                            )}
                            {earned && (
                                <tr>
                                    <td>
                                        <Translate content="account.member.remaining" />
                                    </td>
                                    <td>
                                        {utils.format_number(
                                            (vestingPeriod *
                                                (1 - availablePercent)) /
                                                secondsPerDay || 0,
                                            2
                                        )}
                                        &nbsp;days
                                    </td>
                                </tr>
                            )}
                            <tr>
                                <td>
                                    <Translate content="account.member.available" />
                                </td>
                                {earned ? (
                                    <td>
                                        {utils.format_number(
                                            availablePercent * 100,
                                            2
                                        )}
                                        % /{" "}
                                        {cvbAsset ? (
                                            <FormattedAsset
                                                amount={
                                                    availablePercent *
                                                    vb.balance.amount
                                                }
                                                asset={cvbAsset.get("id")}
                                            />
                                        ) : null}
                                    </td>
                                ) : (
                                    <td>{utils.format_number(100, 2)}%</td>
                                )}
                            </tr>
                            <tr>
                                <td colSpan="2" style={{textAlign: "right"}}>
                                    <button
                                        onClick={this._onClaim.bind(
                                            this,
                                            false
                                        )}
                                        className="button"
                                    >
                                        <Translate content="account.member.claim" />
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                ) : (
                    <LoadingIndicator type="circle" />
                )}
            </div>
        );
    }
}

class AccountVesting extends React.Component {
    constructor() {
        super();

        this.state = {
            vbs: [],
            loading: true
        };
    }

    componentWillMount() {
        this.retrieveVestingBalances.call(this, this.props.account.get("id"));
    }

    componentWillUpdate(nextProps) {
        let newId = nextProps.account.get("id");
        let oldId = this.props.account.get("id");

        if (newId !== oldId) {
            this.retrieveVestingBalances.call(this, newId);
        }
    }

    retrieveVestingBalances(accountId) {
        accountId = accountId || this.props.account.get("id");
        Apis.instance()
            .db_api()
            .exec("get_vesting_balances", [accountId])
            .then(vbs => {
                this.setState({vbs, loading: false});
            })
            .catch(err => {
                console.log("error:", err);
            });
    }

    render() {
        let {vbs, loading} = this.state;

        let account = this.props.account.toJS();

        let balances = vbs
            .map(vb => {
                if (vb.balance.amount) {
                    return (
                        <VestingBalance
                            key={vb.id}
                            vb={vb}
                            account={account}
                            handleChanged={this.retrieveVestingBalances.bind(
                                this
                            )}
                        />
                    );
                }
            })
            .filter(a => {
                return !!a;
            });

        return (
            <div className="grid-content app-tables no-padding" ref="appTables">
                <div className="content-block small-12">
                    <div className="tabs-container generic-bordered-box">
                        <Tabs
                            segmented={false}
                            setting="vestingTab"
                            className="account-tabs"
                            tabsClass="account-overview bordered-header content-block"
                            contentClass="padding"
                        >
                            <Tab title="account.vesting.title">
                                <Translate
                                    content="account.vesting.explain"
                                    component="p"
                                />
                                {!balances.length ? (
                                    <h4 style={{paddingTop: "1rem"}}>
                                        <Translate
                                            content={
                                                "account.vesting.no_balances"
                                            }
                                        />
                                    </h4>
                                ) : (
                                    <div>
                                        {loading ? <LoadingIndicator /> : null}
                                        {balances}
                                    </div>
                                )}
                            </Tab>
                        </Tabs>
                    </div>
                </div>
            </div>
        );
    }
}

AccountVesting.VestingBalance = VestingBalance;
export default AccountVesting;
