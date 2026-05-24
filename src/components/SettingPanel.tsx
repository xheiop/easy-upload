import { useState, useCallback, useMemo, useEffect } from 'preact/hooks';
import { JSX } from 'preact';
import { $t } from '@/common';
import { PT_SITE, SORTED_SITE_KEYS, SiteName } from '@/const';
import { FeatureSwitchList, SiteListConfig } from './conf';
import { toast } from 'sonner';

interface SiteConfig {
  site: string;
  targetEnabled: boolean;
  batchEnabled: boolean;
  searchEnabled: boolean;
}

interface FeatureConfig {
  name: string;
  des: string;
  type: string;
  checked: boolean;
}

const SettingPanel = ({
  closePanel,
}: {
  closePanel: JSX.MouseEventHandler<HTMLButtonElement>;
}) => {
  const [siteList, setSiteList] = useState<SiteConfig[]>([]);
  const [featureList, setFeatureList] = useState<FeatureConfig[]>([]);

  useEffect(() => {
    const targetSitesEnabled = GM_getValue<string[]>(
      'easy-upload.enabled-target-sites',
      [],
    );
    const batchSeedSiteEnabled = GM_getValue<string[]>(
      'easy-upload.enabled-batch-seed-sites',
      [],
    );
    const searchSitesEnabled = GM_getValue<string[]>(
      'easy-upload.enabled-search-site-list',
      [],
    );

    const initialSiteList = SORTED_SITE_KEYS.map((site) => ({
      site,
      targetEnabled: targetSitesEnabled.includes(site),
      batchEnabled: batchSeedSiteEnabled.includes(site),
      searchEnabled: searchSitesEnabled.includes(site),
    }));

    setSiteList(initialSiteList);

    const initialFeatureList = FeatureSwitchList.map((feature) => ({
      ...feature,
      checked: GM_getValue<boolean>(`easy-upload.${feature.name}`, false),
    }));

    setFeatureList(initialFeatureList);
  }, []);

  const saveSetting = useCallback(() => {
    try {
      const targetSitesEnabled: string[] = [];
      const searchSitesEnabled: string[] = [];
      const batchSeedSiteEnabled: string[] = [];

      siteList.forEach(
        ({ site, targetEnabled, batchEnabled, searchEnabled }) => {
          if (targetEnabled) targetSitesEnabled.push(site);
          if (searchEnabled) searchSitesEnabled.push(site);
          if (batchEnabled) batchSeedSiteEnabled.push(site);
        },
      );

      GM_setValue('easy-upload.enabled-target-sites', targetSitesEnabled);
      GM_setValue('easy-upload.enabled-search-site-list', searchSitesEnabled);
      GM_setValue('easy-upload.enabled-batch-seed-sites', batchSeedSiteEnabled);

      featureList.forEach((feature) => {
        GM_setValue(`easy-upload.${feature.name}`, !!feature.checked);
      });

      toast.success($t('设置已保存，页面将重新加载'));
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('保存设置失败:', error);
      toast.error($t('保存本地站点设置失败'));
    }
  }, [siteList, featureList]);

  const handleSiteCheckChange = useCallback(
    (key: keyof Omit<SiteConfig, 'site'>, index: number) => {
      setSiteList((prevList) => {
        const newList = [...prevList];
        newList[index] = {
          ...newList[index],
          [key]: !newList[index][key],
        };
        return newList;
      });
    },
    [],
  );

  const handleFeatureChange = useCallback((index: number) => {
    setFeatureList((prevList) => {
      const newList = [...prevList];
      newList[index] = {
        ...newList[index],
        checked: !newList[index].checked,
      };
      return newList;
    });
  }, []);

  const renderSiteConfigSections = useMemo(() => {
    return SiteListConfig.map((config) => (
      <div key={config.name}>
        <h3>{$t(config.title)}</h3>
        {config.des && <p>{$t(config.des)}</p>}
        <section className="site-enable-setting">
          <ul className={config.class}>
            {siteList.map((siteInfo, index) => {
              const siteData = PT_SITE[
                siteInfo.site as SiteName
              ] as Site.SiteInfo;
              const shouldRender =
                (siteData.asTarget && config.key !== 'searchEnabled') ||
                (config.key === 'searchEnabled' && siteData.search);

              if (!shouldRender) return null;

              return (
                <li key={siteInfo.site}>
                  <label>
                    <input
                      onChange={() =>
                        handleSiteCheckChange(
                          config.key as keyof Omit<SiteConfig, 'site'>,
                          index,
                        )
                      }
                      name="target-site-enabled"
                      type="checkbox"
                      checked={
                        siteInfo[config.key as keyof Omit<SiteConfig, 'site'>]
                      }
                    />
                    {siteInfo.site}
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    ));
  }, [siteList, handleSiteCheckChange]);

  const renderFeatureSwitches = useMemo(() => {
    return (
      <div className="feature-list">
        {featureList.map((feature, index) => (
          <section className="site-enable-setting" key={feature.name}>
            <label>
              <input
                onChange={() => handleFeatureChange(index)}
                name={feature.name}
                type={feature.type}
                checked={feature.checked}
              />
              {$t(feature.des)}
            </label>
          </section>
        ))}
      </div>
    );
  }, [featureList, handleFeatureChange]);

  return (
    <div className="easy-upload-setting-panel">
      <div className="panel-content-wrap">
        <div className="panel-content">
          {renderSiteConfigSections}

          <h3>{$t('额外功能关闭')}</h3>
          {renderFeatureSwitches}
        </div>

        <div className="confirm-btns">
          <button onClick={closePanel}>{$t('取消')}</button>
          <button onClick={saveSetting} className="save-setting-btn">
            {$t('保存')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingPanel;
